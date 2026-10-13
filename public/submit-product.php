<?php
/*
 * Product submission endpoint.
 *
 * WHY THIS EXISTS
 *
 * New products reach the website through a pull request, because the
 * catalogue is a committed file and the build reads it. That is the right
 * shape -- it keeps a human review step in front of anything that goes live
 * -- but it means the person who actually has the photographs and the
 * supplier's spec sheet cannot contribute without a git checkout.
 *
 * This endpoint is the other end of that. It takes a filled-in form and a set
 * of photographs from someone with no technical access at all, parks them on
 * this host, and lets `npm run submissions:ingest` turn them into a branch and
 * a pull request later.
 *
 * WHY PHP, ON THIS HOST
 *
 * The site is a static export with no Node runtime here, but cPanel runs PHP
 * and the enquiry form has used it successfully for some time. Same origin,
 * no CORS, no third-party processor holding the shop's product data, and
 * nothing new to pay for or rotate.
 *
 * SECURITY POSTURE
 *
 * This accepts file uploads, which is a materially more dangerous thing than
 * the enquiry form does, so:
 *
 *  - It fails CLOSED. With no passphrase configured it refuses every request.
 *    There is no default credential and no "open until configured" mode.
 *  - The passphrase lives in the same untracked config file enquiry.php uses,
 *    created by hand in cPanel. Nothing secret is in this file or the repo.
 *  - Uploads are written OUTSIDE the document root wherever the host allows
 *    it, so a stored file is not addressable over HTTP at all. Where that is
 *    not possible the directory is hardened on creation instead.
 *  - Every stored filename is generated here. Nothing a caller sends is ever
 *    used as a path segment.
 *  - A file must pass getimagesize() and agree with its claimed type before it
 *    is kept, so an executable renamed to .jpg does not survive the check.
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');

/*
 * Anything thrown below must still leave as JSON.
 *
 * Found by testing: a missing extension produced an uncaught Error, and PHP
 * answered 200 with a stack trace in the body. That is wrong twice over -- it
 * hands out absolute server paths, and the browser reads a success status for
 * a submission that was never stored. Both are fixed by refusing to let any
 * failure reach the client unshaped.
 */
ini_set('display_errors', '0');

set_exception_handler(static function (Throwable $e): void {
    error_log('submit-product: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
    }
    echo json_encode(['ok' => false, 'error' => 'Something went wrong at our end. Please try again.']);
});

register_shutdown_function(static function (): void {
    $last = error_get_last();
    if ($last === null || !in_array($last['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    error_log('submit-product: fatal ' . $last['message'] . ' @ ' . $last['file'] . ':' . $last['line']);
    if (!headers_sent()) {
        http_response_code(500);
    }
    echo json_encode(['ok' => false, 'error' => 'Something went wrong at our end. Please try again.']);
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_DRAFT = 40;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MIN_IMAGE_EDGE = 500;
const DRAFT_TTL_DAYS = 14;

/*
 * Brute-force limits on the access code.
 *
 * The code itself is the real defence -- a 32-character random one is not
 * going to be guessed -- but a weak code chosen in a hurry should not be
 * quietly guessable either, and a failing loop should not be free.
 */
const MAX_FAILURES = 8;
const FAILURE_WINDOW = 900;

/** Ceiling on drafts awaiting collection, so a code-holder cannot fill the disk. */
const MAX_PENDING_DRAFTS = 60;

/** Claimed type => the extension we will actually store it under. */
const ALLOWED_TYPES = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG => 'png',
    IMAGETYPE_WEBP => 'webp',
];

function fail(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

function ok(array $payload = []): never
{
    echo json_encode(['ok' => true] + $payload);
    exit;
}

/*
 * Optional settings, read from a file created by hand in cPanel that is
 * deliberately not part of the deployment. The FTP step runs without
 * dangerous-clean-slate, so it only writes paths the build produced and never
 * touches this file.
 *
 * Unlike enquiry.php there is no workable default here: without `submit_key`
 * the endpoint stays shut.
 */
function config(): array
{
    $defaults = [
        'submit_key' => '',
        'notify' => 'heavencraftorders@gmail.com',
        'from' => 'noreply@theheavencraft.in',
        'from_name' => 'HeavenCraft website',
    ];

    foreach ([
        dirname(__DIR__) . '/heavencraft-config.php',
        __DIR__ . '/../private/heavencraft-config.php',
        '/home/' . get_current_user() . '/heavencraft-config.php',
    ] as $candidate) {
        if (is_readable($candidate)) {
            $loaded = include $candidate;
            if (is_array($loaded)) {
                return array_merge($defaults, $loaded);
            }
        }
    }

    return $defaults;
}

/**
 * Where submissions are parked.
 *
 * Outside the document root by preference: a file that cannot be addressed
 * over HTTP cannot be served, whatever it turns out to contain. The last
 * candidate is inside the root and is hardened on creation, because a host
 * that chroots the account to public_html leaves no other option and a
 * working form matters more than the ideal layout.
 */
function storageRoot(): string
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }

    $candidates = [
        dirname(__DIR__) . '/heavencraft-submissions',
        '/home/' . get_current_user() . '/heavencraft-submissions',
        __DIR__ . '/_submissions',
    ];

    foreach ($candidates as $path) {
        if (!is_dir($path) && !@mkdir($path, 0750, true) && !is_dir($path)) {
            continue;
        }
        if (!is_writable($path)) {
            continue;
        }
        if (str_starts_with($path, __DIR__)) {
            harden($path);
        }
        $resolved = $path;
        return $resolved;
    }

    fail(500, 'Uploads are not configured on this host.');
}

/**
 * Belt and braces for the in-document-root fallback: refuse to serve anything
 * from the directory, and stop PHP executing in it even if something slipped
 * past the image check above.
 */
function harden(string $dir): void
{
    $htaccess = $dir . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents(
            $htaccess,
            "Require all denied\n"
            . "<IfModule mod_php.c>\nphp_flag engine off\n</IfModule>\n"
            . "RemoveHandler .php .phtml .php5 .php7 .php8\n"
            . "AddType text/plain .php .phtml .php5 .php7 .php8\n"
        );
    }
    if (!is_file($dir . '/index.html')) {
        @file_put_contents($dir . '/index.html', '');
    }
}

/**
 * Who is making this request, for throttling purposes only.
 *
 * REMOTE_ADDR alone is wrong here: the site is proxied through Cloudflare, so
 * every visitor arrives from one of a handful of edge addresses and a per-IP
 * counter would lock out the whole world the moment one person mistyped the
 * code. CF-Connecting-IP carries the real client.
 *
 * That header is only trustworthy because Cloudflare sets it; someone who
 * reached the origin directly could forge it. The consequence of a forged
 * value is that an attacker evades their own throttle, which leaves us no
 * worse off than having none -- whereas trusting REMOTE_ADDR would break the
 * form for legitimate users every day.
 */
function clientKey(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '',
        $_SERVER['REMOTE_ADDR'] ?? '',
    ];

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || $candidate === '') {
            continue;
        }
        // X-Forwarded-For may be a chain; the client is the first entry.
        $first = trim(explode(',', $candidate)[0]);
        if ($first !== '') {
            return hash('sha256', $first);
        }
    }

    return 'unknown';
}

function throttleFile(): string
{
    return sys_get_temp_dir() . '/hc-sub-auth-' . clientKey();
}

function failureCount(): int
{
    $path = throttleFile();
    if (!is_file($path)) {
        return 0;
    }
    $state = json_decode((string) @file_get_contents($path), true);
    if (!is_array($state) || (time() - (int) ($state['since'] ?? 0)) > FAILURE_WINDOW) {
        return 0;
    }
    return (int) ($state['n'] ?? 0);
}

function noteFailure(int $current): void
{
    $since = $current === 0 ? time() : (int) (json_decode(
        (string) @file_get_contents(throttleFile()),
        true
    )['since'] ?? time());

    @file_put_contents(
        throttleFile(),
        json_encode(['n' => $current + 1, 'since' => $since])
    );
}

function requireKey(array $config): void
{
    $expected = (string) ($config['submit_key'] ?? '');

    if ($expected === '') {
        fail(503, 'Submissions are not enabled yet.');
    }

    $failures = failureCount();
    if ($failures >= MAX_FAILURES) {
        fail(429, 'Too many attempts. Try again in fifteen minutes.');
    }

    $supplied = $_POST['key'] ?? $_SERVER['HTTP_X_SUBMIT_KEY'] ?? '';
    if (!is_string($supplied) || !hash_equals($expected, $supplied)) {
        noteFailure($failures);
        // Slow a guessing loop without holding a worker open for long.
        usleep(400000);
        fail(401, 'That access code was not recognised.');
    }

    @unlink(throttleFile());
}

/** Draft ids are generated by the client, so they are checked before use. */
function draftId(): string
{
    $raw = $_POST['draft'] ?? '';
    if (!is_string($raw) || !preg_match('/^[a-f0-9]{16,32}$/', $raw)) {
        fail(422, 'Bad draft reference.');
    }
    return $raw;
}

function draftDir(string $draft): string
{
    return storageRoot() . '/' . $draft;
}

function countDrafts(): int
{
    return count(glob(storageRoot() . '/*', GLOB_ONLYDIR) ?: []);
}

/** Drops drafts nobody finished, so abandoned uploads do not accumulate. */
function sweep(): void
{
    $cutoff = time() - (DRAFT_TTL_DAYS * 86400);
    foreach (glob(storageRoot() . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
        if (is_file($dir . '/submission.json')) {
            continue;
        }
        if (filemtime($dir) > $cutoff) {
            continue;
        }
        foreach (glob($dir . '/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($dir);
    }
}

function handleImage(): never
{
    $draft = draftId();
    $dir = draftDir($draft);

    if (!is_dir($dir)) {
        /*
         * A new draft. Swept first so a long-abandoned one is cleared before
         * the ceiling is counted, and capped so that someone with the code --
         * or a session that keeps retrying -- cannot quietly fill the account's
         * disk and take the website down with it.
         */
        sweep();
        if (countDrafts() >= MAX_PENDING_DRAFTS) {
            fail(507, 'There are too many submissions waiting to be collected. Please tell us before sending more.');
        }
        if (!@mkdir($dir, 0750, true) && !is_dir($dir)) {
            fail(500, 'Could not open that draft.');
        }
    }

    $file = $_FILES['image'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        fail(422, uploadError(is_array($file) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE));
    }

    if (($file['size'] ?? 0) > MAX_IMAGE_BYTES) {
        fail(413, 'That photo is too large. Keep each one under 8 MB.');
    }

    if (!is_uploaded_file($file['tmp_name'])) {
        fail(400, 'That upload did not arrive correctly.');
    }

    if (count(glob($dir . '/img-*') ?: []) >= MAX_IMAGES_PER_DRAFT) {
        fail(413, 'That is more photos than one product can take.');
    }

    /*
     * The only check that matters. An attacker controls the filename and the
     * Content-Type header; they do not control whether the bytes parse as an
     * image of a type we accept.
     */
    $info = @getimagesize($file['tmp_name']);
    if ($info === false || !isset(ALLOWED_TYPES[$info[2]])) {
        fail(415, 'That file is not a JPEG, PNG or WebP image.');
    }

    [$width, $height] = $info;
    if ($width < MIN_IMAGE_EDGE || $height < MIN_IMAGE_EDGE) {
        fail(422, sprintf(
            'That photo is only %d×%d. We need at least %d pixels on each side.',
            $width,
            $height,
            MIN_IMAGE_EDGE
        ));
    }

    $name = sprintf('img-%s.%s', bin2hex(random_bytes(8)), ALLOWED_TYPES[$info[2]]);
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
        fail(500, 'That photo could not be saved.');
    }
    @chmod($dir . '/' . $name, 0640);

    ok(['image' => $name, 'width' => $width, 'height' => $height]);
}

function uploadError(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'That photo is larger than this server accepts.',
        UPLOAD_ERR_PARTIAL => 'That upload was cut off. Try again.',
        UPLOAD_ERR_NO_FILE => 'No photo was attached.',
        UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'This server could not store the photo.',
        default => 'That photo could not be uploaded.',
    };
}

function handleSubmit(array $config): never
{
    $draft = draftId();
    $dir = draftDir($draft);

    if (!is_dir($dir)) {
        fail(422, 'That draft has expired. Please fill the form again.');
    }

    if (is_file($dir . '/submission.json')) {
        fail(409, 'That submission has already been sent.');
    }

    $raw = $_POST['payload'] ?? '';
    if (!is_string($raw) || $raw === '') {
        fail(422, 'The form came through empty.');
    }
    if (strlen($raw) > MAX_PAYLOAD_BYTES) {
        fail(413, 'That is more text than the form accepts.');
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        fail(422, 'The form could not be read.');
    }

    $errors = validate($payload, $dir);
    if ($errors !== []) {
        fail(422, implode(' ', $errors));
    }

    $record = [
        'id' => $draft,
        'receivedAt' => gmdate('c'),
        'remote' => hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? '')),
        'product' => $payload,
    ];

    $written = @file_put_contents(
        $dir . '/submission.json',
        json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
    );

    if ($written === false) {
        fail(500, 'That submission could not be saved.');
    }
    @chmod($dir . '/submission.json', 0640);

    notify($config, $payload, $draft);
    sweep();

    ok(['id' => $draft]);
}

/**
 * The completeness gate, enforced here as well as in the browser.
 *
 * This is the whole point of the exercise. A product that reaches the
 * catalogue without specifications or features renders as a page with empty
 * sections, and the only reliable moment to catch that is while the person
 * with the supplier's sheet still has it open.
 */
function validate(array $p, string $dir): array
{
    $errors = [];

    $text = static fn(string $k): string => is_string($p[$k] ?? null) ? trim($p[$k]) : '';
    $rows = static fn(string $k): array => is_array($p[$k] ?? null) ? $p[$k] : [];

    if (mb_strlen($text('name')) < 3) {
        $errors[] = 'A product name is required.';
    }
    if (!in_array($p['category'] ?? '', ['chair', 'table', 'accessories'], true)) {
        $errors[] = 'Pick a category.';
    }
    if (mb_strlen($text('subName')) < 2) {
        $errors[] = 'A range name is required.';
    }
    if (mb_strlen($text('description')) < 40) {
        $errors[] = 'The description needs to be a little longer.';
    }

    $price = $p['price'] ?? null;
    if (!is_numeric($price) || (float) $price <= 0) {
        $errors[] = 'A price is required.';
    }
    if (isset($p['mrp']) && $p['mrp'] !== null && $p['mrp'] !== '') {
        if (!is_numeric($p['mrp']) || (float) $p['mrp'] < (float) $price) {
            $errors[] = 'The MRP cannot be below the selling price.';
        }
    }

    $features = $rows('features');
    if (count($features) < 3) {
        $errors[] = 'At least three features are needed.';
    }
    foreach ($features as $f) {
        if (!is_array($f) || trim((string) ($f['title'] ?? '')) === '') {
            $errors[] = 'Every feature needs a heading.';
            break;
        }
    }

    $specs = $rows('specifications');
    if (count($specs) < 3) {
        $errors[] = 'At least three specifications are needed.';
    }
    foreach ($specs as $s) {
        if (
            !is_array($s)
            || trim((string) ($s['label'] ?? '')) === ''
            || trim((string) ($s['value'] ?? '')) === ''
        ) {
            $errors[] = 'Every specification needs both a label and a value.';
            break;
        }
    }

    $variants = $rows('variants');
    if ($variants === []) {
        $errors[] = 'At least one colour is needed.';
    }

    /*
     * Images are referenced by the names this endpoint handed back, so a
     * payload cannot name a file it did not upload -- and cannot name one
     * belonging to a different draft, because the glob is scoped to this one.
     */
    $onDisk = array_map('basename', glob($dir . '/img-*') ?: []);
    foreach ($variants as $v) {
        $colour = is_array($v) ? trim((string) ($v['colour'] ?? '')) : '';
        if ($colour === '') {
            $errors[] = 'Every colour needs a name.';
            break;
        }
        $images = is_array($v['images'] ?? null) ? $v['images'] : [];
        if (count($images) < 3) {
            $errors[] = sprintf('“%s” needs at least three photographs.', $colour);
        }
        foreach ($images as $image) {
            if (!is_string($image) || !in_array($image, $onDisk, true)) {
                $errors[] = 'One of the photographs did not upload correctly.';
                break 2;
            }
        }
    }

    return $errors;
}

function headerSafe(string $value): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $value) ?? '');
}

function notify(array $config, array $payload, string $draft): void
{
    $name = headerSafe((string) ($payload['name'] ?? 'Untitled'));
    $variants = is_array($payload['variants'] ?? null) ? $payload['variants'] : [];
    $photos = 0;
    foreach ($variants as $v) {
        $photos += is_array($v['images'] ?? null) ? count($v['images']) : 0;
    }

    $body = implode("\n", [
        'A product was submitted through the website form.',
        '',
        'Name:      ' . $name,
        'Category:  ' . (string) ($payload['category'] ?? '-'),
        'Range:     ' . (string) ($payload['subName'] ?? '-'),
        'Price:     ' . (string) ($payload['price'] ?? '-'),
        'Colours:   ' . count($variants),
        'Photos:    ' . $photos,
        'Reference: ' . $draft,
        '',
        'Run `npm run submissions:ingest` to turn it into a pull request.',
    ]);

    $headers = [
        'From' => sprintf('%s <%s>', headerSafe((string) $config['from_name']), $config['from']),
        'Content-Type' => 'text/plain; charset=UTF-8',
        'MIME-Version' => '1.0',
        'X-Mailer' => 'heavencraft-submission',
    ];

    $lines = [];
    foreach ($headers as $key => $value) {
        $lines[] = $key . ': ' . headerSafe((string) $value);
    }

    @mail(
        (string) $config['notify'],
        '=?UTF-8?B?' . base64_encode('[Product] ' . $name) . '?=',
        $body,
        implode("\r\n", $lines),
        '-f' . $config['from']
    );
}

/**
 * Collection is authenticated separately from submission.
 *
 * The submit key is handed to suppliers and typed into a phone in a
 * showroom; it will leak eventually. It can only add a draft. The collect
 * key can read every submission the shop has received, so it lives in one
 * place -- the repository's Actions secrets -- and nowhere else. Neither key
 * grants the other's powers.
 */
function requireCollectKey(array $config): void
{
    $expected = (string) ($config['collect_key'] ?? '');

    if ($expected === '') {
        fail(503, 'Collection is not enabled.');
    }

    $failures = failureCount();
    if ($failures >= MAX_FAILURES) {
        fail(429, 'Too many attempts.');
    }

    $supplied = $_POST['collect_key'] ?? $_SERVER['HTTP_X_COLLECT_KEY'] ?? '';
    if (!is_string($supplied) || !hash_equals($expected, $supplied)) {
        noteFailure($failures);
        usleep(400000);
        fail(401, 'Not authorised.');
    }

    @unlink(throttleFile());
}

/** Every submitted draft, newest last, with its payload inlined. */
function handleList(): never
{
    $out = [];

    foreach (glob(storageRoot() . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
        $file = $dir . '/submission.json';
        // A directory without one is a draft still being filled in. Skipping
        // it is what stops the ingest picking up half an upload.
        if (!is_file($file)) {
            continue;
        }
        $parsed = json_decode((string) @file_get_contents($file), true);
        if (is_array($parsed)) {
            $out[] = $parsed;
        }
    }

    usort($out, fn($a, $b) => strcmp((string) ($a['receivedAt'] ?? ''), (string) ($b['receivedAt'] ?? '')));

    ok(['drafts' => $out]);
}

/**
 * Streams one image out of one draft.
 *
 * The name is matched against the directory's actual contents rather than
 * being trusted and concatenated, so there is no path for "../" to take even
 * if the draft id check above were somehow bypassed.
 */
function handleFile(): never
{
    $dir = draftDir(draftId());
    $name = (string) ($_POST['name'] ?? '');

    $match = null;
    foreach (glob($dir . '/img-*') ?: [] as $candidate) {
        if (basename($candidate) === $name) {
            $match = $candidate;
            break;
        }
    }

    if ($match === null) {
        fail(404, 'No such file.');
    }

    $info = @getimagesize($match);
    header('Content-Type: ' . ($info['mime'] ?? 'application/octet-stream'));
    header('Content-Length: ' . (string) filesize($match));
    readfile($match);
    exit;
}

/**
 * Drops a draft once it is safely in a pull request.
 *
 * Called only after the ingest has committed, so that a job which dies
 * midway leaves the submission on the host to be collected again rather than
 * losing a client's photographs to a failed CI run.
 */
function handleDone(): never
{
    $dir = draftDir(draftId());

    if (!is_dir($dir)) {
        // Already collected. Saying so plainly keeps a retried job idempotent.
        ok(['removed' => false]);
    }

    foreach (glob($dir . '/*') ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($dir);

    ok(['removed' => true]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'Use POST.');
}

$config = config();

/*
 * Collection actions check the collect key and never the submit key, so a
 * leaked submit key cannot read anything back out.
 */
$action = $_POST['action'] ?? '';

switch ($action) {
    case 'list':
    case 'file':
    case 'done':
        requireCollectKey($config);
        break;
    default:
        requireKey($config);
}

switch ($action) {
    case 'ping':
        // Lets the form check the access code before anyone fills in a long
        // form and discovers at the end that it was wrong.
        ok();
    case 'image':
        handleImage();
    case 'submit':
        handleSubmit($config);
    case 'list':
        handleList();
    case 'file':
        handleFile();
    case 'done':
        handleDone();
    default:
        fail(400, 'Unknown action.');
}
