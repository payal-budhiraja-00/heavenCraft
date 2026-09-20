<?php
/*
 * TEMPORARY DIAGNOSTIC -- delete once the contact form decision is made.
 *
 * The origin sits behind Cloudflare, which rewrites Server: and strips
 * X-Powered-By, so there is no way to tell from outside whether this host
 * runs PHP at all, nor whether it will let a script open an outbound SMTP
 * connection. Shared hosts very often block every outbound mail port except
 * their own relay. That single fact decides whether the contact form can post
 * to this server or has to go to a third party, so it is worth one request to
 * find out rather than guessing.
 *
 * Reports only capabilities. Sends nothing, stores nothing, reads no secrets.
 */

header('Content-Type: application/json');
header('Cache-Control: no-store');

function port_open(string $host, int $port, float $timeout = 4.0): array
{
    $started = microtime(true);
    $errno = 0;
    $errstr = '';
    $conn = @fsockopen($host, $port, $errno, $errstr, $timeout);
    $ms = (int) round((microtime(true) - $started) * 1000);

    if (!$conn) {
        return ['open' => false, 'ms' => $ms, 'error' => $errstr ?: "errno $errno"];
    }

    // Read the SMTP greeting. A port that accepts the TCP handshake but never
    // greets is a silent blackhole, which is not the same as a usable relay.
    stream_set_timeout($conn, 4);
    $greeting = @fgets($conn, 256);
    fclose($conn);

    return [
        'open' => true,
        'ms' => $ms,
        'greeting' => $greeting ? trim(substr($greeting, 0, 90)) : '(no greeting)',
    ];
}

$disabled = array_filter(array_map('trim', explode(',', (string) ini_get('disable_functions'))));

echo json_encode([
    'php' => [
        'version' => PHP_VERSION,
        'sapi' => PHP_SAPI,
        'mail_function' => function_exists('mail') && !in_array('mail', $disabled, true),
        'openssl' => extension_loaded('openssl'),
        'curl' => extension_loaded('curl'),
        'allow_url_fopen' => (bool) ini_get('allow_url_fopen'),
        'sendmail_path' => ini_get('sendmail_path') ?: '(unset)',
        'disabled_functions' => $disabled ? array_values($disabled) : [],
    ],
    // Can this box reach a mail relay at all?
    'outbound' => [
        'localhost:25' => port_open('localhost', 25),
        'godaddy_relay:465' => port_open('smtpout.secureserver.net', 465),
        'godaddy_relay:587' => port_open('smtpout.secureserver.net', 587),
        'gmail:465' => port_open('smtp.gmail.com', 465),
        'gmail:587' => port_open('smtp.gmail.com', 587),
        'brevo:587' => port_open('smtp-relay.brevo.com', 587),
    ],
    /*
     * Every SMTP port is firewalled, so the fallback is an email provider's
     * HTTPS API instead of SMTP. That only works if outbound 443 is allowed,
     * which is a separate question from outbound 25/465/587.
     */
    'outbound_https' => [
        'api.brevo.com:443' => port_open('api.brevo.com', 443),
        'api.resend.com:443' => port_open('api.resend.com', 443),
    ],
    'https_fetch' => (function () {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'no curl'];
        }
        $ch = curl_init('https://api.resend.com/');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_NOBODY => true,
        ]);
        $ok = curl_exec($ch) !== false;
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        return ['ok' => $ok, 'http_code' => $code, 'error' => $err ?: null];
    })(),
    'server' => [
        'software' => $_SERVER['SERVER_SOFTWARE'] ?? '(unknown)',
        'name' => $_SERVER['SERVER_NAME'] ?? '(unknown)',
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
