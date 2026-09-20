<?php
/*
 * Enquiry endpoint.
 *
 * WHY THIS SHAPE
 *
 * This host firewalls every outbound SMTP port -- GoDaddy's own relay, Gmail
 * and Brevo on both 465 and 587 all time out. Only localhost:25 answers, where
 * cPanel's Exim is listening. So an SMTP library pointed at smtp.gmail.com
 * cannot work here no matter what credentials it is given, and PHP's mail(),
 * which hands off to that local Exim, is the transport that does.
 *
 * That is a security result as much as a technical one: this file needs no
 * username, no password and no API key, so there is no secret to commit, leak
 * or rotate. Nothing sensitive belongs in this file and nothing is read from
 * the repository.
 *
 * If delivery ever needs to move to a provider's HTTPS API (outbound 443 is
 * open), put the key in the untracked config described below -- never here.
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');

const MAX_FIELD = 200;
const MAX_MESSAGE = 5000;

/*
 * Optional overrides, read from a file that is created by hand in cPanel and
 * is deliberately NOT part of the deployment. The FTP step runs without
 * dangerous-clean-slate, so it only writes paths the build produced and never
 * touches or removes this file. Absent, everything below falls back to a safe
 * default, so the form works with no configuration at all.
 */
function config(): array
{
    $defaults = [
        'to' => 'heavencraft09@gmail.com',
        // Envelope sender. Must be at this domain for SPF/DMARC to line up.
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

function fail(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

/*
 * The classic mail() vulnerability: a newline in any value that reaches a
 * header lets the sender append headers of their own and turn this into an
 * open relay. Strip CR and LF outright rather than trying to detect abuse.
 */
function header_safe(string $value): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $value) ?? '');
}

function field(string $name, int $max = MAX_FIELD): string
{
    $raw = $_POST[$name] ?? '';
    if (!is_string($raw)) {
        return '';
    }
    return mb_substr(trim($raw), 0, $max);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'Use POST.');
}

// Bots fill in every field they find. Humans never see this one.
if (field('company') !== '') {
    // Answer as though it worked, so the bot has nothing to learn from.
    echo json_encode(['ok' => true]);
    exit;
}

$name = field('name');
$email = field('email');
$phone = field('phone');
$pincode = field('pincode', 12);
$subject = field('subject');
$message = field('message', MAX_MESSAGE);

if ($name === '' || $email === '' || $message === '') {
    fail(422, 'Name, email and message are required.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail(422, 'That email address does not look right.');
}

/*
 * Crude but sufficient flood control. One address, one message a minute. The
 * temp directory is writable on this host and the state is disposable, so this
 * needs no database.
 */
$throttle = sys_get_temp_dir() . '/hc-enq-' . hash('sha256', $email);
if (is_file($throttle) && (time() - (int) filemtime($throttle)) < 60) {
    fail(429, 'That went through a moment ago. Give it a minute.');
}
@touch($throttle);

$config = config();

$safeSubject = header_safe($subject !== '' ? $subject : 'Website enquiry');
$safeEmail = header_safe($email);
$safeName = header_safe($name);

$body = implode("\n", [
    'Name:     ' . $name,
    'Email:    ' . $email,
    'Phone:    ' . ($phone !== '' ? $phone : '-'),
    'Pincode:  ' . ($pincode !== '' ? $pincode : '-'),
    '',
    $message,
    '',
    '---',
    'Sent from the enquiry form at ' . ($_SERVER['HTTP_HOST'] ?? 'theheavencraft.in'),
    'Received: ' . gmdate('c'),
]);

$headers = [
    // From must stay at this domain so it aligns with SPF and the domain's
    // DMARC policy. The visitor's address goes in Reply-To, which is not
    // authenticated and so cannot break that alignment.
    'From' => sprintf('%s <%s>', header_safe($config['from_name']), $config['from']),
    'Reply-To' => $safeName !== '' ? sprintf('%s <%s>', $safeName, $safeEmail) : $safeEmail,
    'Content-Type' => 'text/plain; charset=UTF-8',
    'MIME-Version' => '1.0',
    'X-Mailer' => 'heavencraft-enquiry',
];

$headerLines = [];
foreach ($headers as $key => $value) {
    $headerLines[] = $key . ': ' . header_safe((string) $value);
}

$sent = @mail(
    $config['to'],
    '=?UTF-8?B?' . base64_encode('[Enquiry] ' . $safeSubject) . '?=',
    $body,
    implode("\r\n", $headerLines),
    '-f' . $config['from'],
);

if (!$sent) {
    fail(502, 'The message could not be sent. Please email us directly.');
}

echo json_encode(['ok' => true]);
