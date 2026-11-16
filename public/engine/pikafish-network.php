<?php
declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    header('Content-Type: text/plain; charset=utf-8');
    exit('Method not allowed');
}

if (!extension_loaded('curl')) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    exit('The PHP cURL extension is required to download the Pikafish network.');
}

set_time_limit(0);
while (ob_get_level() > 0) {
    ob_end_clean();
}
ob_implicit_flush(true);

header('Content-Type: application/octet-stream');
header('Cache-Control: public, max-age=86400');
header('Cross-Origin-Resource-Policy: same-origin');
header('X-Accel-Buffering: no');

$networkUrl = 'https://github.com/official-pikafish/Networks/releases/download/master-net/pikafish.nnue';
$handle = curl_init($networkUrl);
if ($handle === false) {
    http_response_code(500);
    exit('Unable to initialize the Pikafish network download.');
}

curl_setopt_array($handle, [
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_CONNECTTIMEOUT => 20,
    CURLOPT_TIMEOUT => 0,
    CURLOPT_NOBODY => $method === 'HEAD',
    CURLOPT_USERAGENT => 'Xiangqi-Studio/1.0',
    CURLOPT_HEADERFUNCTION => static function ($handle, string $line): int {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $line, $matches) === 1) {
            http_response_code((int) $matches[1]);
        }

        if (preg_match('/^Content-Length:\s*(\d+)/i', $line, $matches) === 1) {
            header('Content-Length: ' . $matches[1]);
        }

        return strlen($line);
    },
    CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk): int {
        if (curl_getinfo($handle, CURLINFO_RESPONSE_CODE) >= 400) {
            return strlen($chunk);
        }

        echo $chunk;
        flush();
        return strlen($chunk);
    },
]);

$success = curl_exec($handle);
$status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
$error = curl_error($handle);
curl_close($handle);

if ($success === false) {
    error_log('Pikafish NNUE proxy failed: ' . $error);
    if (!headers_sent()) {
        http_response_code(502);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Unable to fetch the Pikafish network.';
    }
} elseif ($status >= 400 && !headers_sent()) {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Pikafish network download failed: ' . $status;
}
