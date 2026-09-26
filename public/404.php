<?php
/*
 * Not-found handler.
 *
 * WHY THIS FILE EXISTS
 *
 * The build emits a branded 404 page at /404.html and .htaccess declares
 * `ErrorDocument 404 /404.html`. On this host that directive is ignored --
 * unmatched paths were answered with GoDaddy's own grey "File not found"
 * page instead, which offers a visitor no way back into the catalogue. It is
 * not a permissions or syntax problem: every other directive in the same
 * file, including mod_rewrite, mod_alias and mod_headers rules that all
 * require the same AllowOverride level, is demonstrably live in production.
 * The platform intercepts Apache's error handling specifically.
 *
 * What the platform does not intercept is a status code set by PHP. The
 * enquiry endpoint next to this file answers a GET with a 405 and its own
 * JSON body, and that reaches the client intact. So .htaccess rewrites
 * unmatched requests here instead of relying on ErrorDocument, and this file
 * sets the status itself. Apache's error machinery is never entered, so
 * there is nothing for the platform to replace.
 *
 * The page body is not duplicated here. It is read from the 404.html the
 * build already produces, so the design, the header and the catalogue links
 * stay in one place and cannot drift.
 */

declare(strict_types=1);

http_response_code(404);
header('Cache-Control: no-store');

/*
 * A missing stylesheet, script or image is a 404 too, and answering one with
 * fifty kilobytes of page markup wastes the visitor's bandwidth for bytes
 * nothing will render. Those requests do not ask for HTML, so they get a
 * short plain-text body and the correct status, which is all a browser needs
 * to report the failure.
 */
$accept = $_SERVER['HTTP_ACCEPT'] ?? '';
if (strpos($accept, 'text/html') === false && $accept !== '') {
    header('Content-Type: text/plain; charset=utf-8');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        echo "404 Not Found\n";
    }
    exit;
}

header('Content-Type: text/html; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
    exit;
}

/*
 * If the page is somehow absent the status is already correct and a terse
 * body is better than a blank one -- a deploy that dropped 404.html should
 * not also turn every missing page into an empty response.
 */
$page = __DIR__ . '/404.html';
if (is_readable($page)) {
    readfile($page);
    exit;
}

echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width, initial-scale=1">'
    . '<title>Page not found - HeavenCraft</title></head><body>'
    . '<h1>Page not found</h1>'
    . '<p>That page does not exist. <a href="/">Go to the HeavenCraft home page</a>.</p>'
    . '</body></html>';
