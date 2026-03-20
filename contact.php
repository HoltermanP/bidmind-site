<?php
/**
 * Mail-endpoint voor demo-aanvraagformulier (o.a. Strato).
 *
 * Strato: smtp.strato.de — standaard 465 + ssl; bij problemen automatisch 587 + tls.
 * Wachtwoord: contact.secret.php of omgevingsvariabele BIDMIND_SMTP_PASSWORD.
 * Zie MAIL-SETUP.md en contact.secret.php.example.
 */
header('Content-Type: application/json; charset=utf-8');

// ─────────────────────────────────────────────────────────────
// INSTELLINGEN
// ─────────────────────────────────────────────────────────────
$MAIL_CONFIG = [
    'to' => 'info@bidmind.nl',
    'from' => 'info@bidmind.nl',
    'debug' => false,
    'smtp' => [
        'host' => 'smtp.strato.de',
        /** Strato werkt vaak betrouwbaarder met 465 + ssl dan 587 + STARTTLS */
        'port' => 465,
        'encryption' => 'ssl',
        'username' => 'info@bidmind.nl',
        'password' => '',
        /**
         * Alleen true als je TLS-fouten krijgt (certificate verify failed).
         * Minder veilig; liever eerst zonder proberen.
         */
        'relax_ssl' => false,
        /** true = geen tweede poort proberen */
        'no_port_fallback' => false,
    ],
];

$secretFile = __DIR__ . '/contact.secret.php';
if (is_readable($secretFile)) {
    $sec = require $secretFile;
    if (is_array($sec)) {
        if (!empty($sec['smtp']) && is_array($sec['smtp'])) {
            $MAIL_CONFIG['smtp'] = array_merge($MAIL_CONFIG['smtp'], $sec['smtp']);
        }
        if (array_key_exists('debug', $sec)) {
            $MAIL_CONFIG['debug'] = (bool) $sec['debug'];
        }
    }
}

$envPass = getenv('BIDMIND_SMTP_PASSWORD');
if (is_string($envPass) && $envPass !== '' && ($MAIL_CONFIG['smtp']['password'] ?? '') === '') {
    $MAIL_CONFIG['smtp']['password'] = $envPass;
}
// ─────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

if (trim((string) ($_POST['website'] ?? '')) !== '') {
    echo json_encode(['ok' => true]);
    exit;
}

$email = filter_var(trim((string) ($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
if (!$email) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'email']);
    exit;
}

$to = $MAIL_CONFIG['to'];
$fromEmail = $MAIL_CONFIG['from'];

$utf8len = static function (string $s): int {
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
};

$name = trim(preg_replace('/\s+/', ' ', (string) ($_POST['name'] ?? '')));
$message = trim((string) ($_POST['message'] ?? ''));

if ($name === '' || $utf8len($name) > 120) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'name']);
    exit;
}

if ($message === '' || $utf8len($message) < 10) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'message']);
    exit;
}

if ($utf8len($message) > 8000) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'message']);
    exit;
}

$subject = 'Demo-aanvraag www.bidmind.nl';
$body = "Demo-aanvraag via de website.\r\n\r\n";
$body .= 'Naam: ' . $name . "\r\n";
$body .= 'E-mail: ' . $email . "\r\n\r\n";
$body .= "Aanvraag / bericht:\r\n" . $message . "\r\n\r\n";

$body .= 'Tijdstip: ' . gmdate('Y-m-d H:i:s') . " UTC\r\n";
$body .= 'IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'onbekend') . "\r\n";

$smtp = $MAIL_CONFIG['smtp'] ?? [];
$smtpHost = trim((string) ($smtp['host'] ?? ''));
$smtpPassword = (string) ($smtp['password'] ?? '');
$useSmtp = $smtpHost !== '' && $smtpPassword !== '';

$lastMailError = null;
$sent = false;

if ($useSmtp) {
    $pmPath = __DIR__ . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
    if (!is_readable($pmPath)) {
        error_log('[contact.php] PHPMailer ontbreekt (geen leesbaar bestand): ' . $pmPath);
        http_response_code(500);
        $payload = ['ok' => false, 'error' => 'missing_phpmailer'];
        if (!empty($MAIL_CONFIG['debug'])) {
            $payload['detail'] = 'Upload de map vendor/phpmailer/ naar dezelfde map als contact.php.';
        }
        echo json_encode($payload);
        exit;
    }

    require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/Exception.php';
    require_once $pmPath;
    require_once __DIR__ . '/vendor/phpmailer/phpmailer/src/SMTP.php';

    $port = (int) ($smtp['port'] ?? 465);
    $enc = strtolower((string) ($smtp['encryption'] ?? 'ssl'));

    $attempts = [['port' => $port, 'encryption' => $enc]];
    if (empty($smtp['no_port_fallback'])) {
        if ($port === 587 && $enc === 'tls') {
            $attempts[] = ['port' => 465, 'encryption' => 'ssl'];
        } elseif ($port === 465 && $enc === 'ssl') {
            $attempts[] = ['port' => 587, 'encryption' => 'tls'];
        }
    }

    $seen = [];
    foreach ($attempts as $att) {
        $key = $att['port'] . '|' . $att['encryption'];
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;

        $mailer = new PHPMailer\PHPMailer\PHPMailer(true);
        try {
            $mailer->isSMTP();
            $mailer->Host = $smtpHost;
            if (preg_match('/@([^@]+)$/', $fromEmail, $m)) {
                $mailer->Hostname = $m[1];
            }
            $mailer->SMTPAuth = true;
            $mailer->Username = (string) $smtp['username'];
            $mailer->Password = $smtpPassword;
            $mailer->Port = $att['port'];
            $mailer->Timeout = 30;

            if ($att['encryption'] === 'ssl') {
                $mailer->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
            } else {
                $mailer->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            }

            if (!empty($smtp['relax_ssl'])) {
                $mailer->SMTPOptions = [
                    'ssl' => [
                        'verify_peer' => false,
                        'verify_peer_name' => false,
                        'allow_self_signed' => true,
                    ],
                ];
            }

            $mailer->CharSet = 'UTF-8';
            $mailer->setFrom($fromEmail, 'BidMind website');
            $mailer->addAddress($to);
            $mailer->addReplyTo($email, $name);
            $mailer->Subject = $subject;
            $mailer->Body = $body;

            $mailer->send();
            $sent = true;
            break;
        } catch (Throwable $e) {
            $lastMailError = $e->getMessage();
            error_log('[contact.php] SMTP ' . $att['port'] . '/' . $att['encryption'] . ': ' . $lastMailError);
        }
    }
} elseif ($smtpHost !== '') {
    error_log('[contact.php] SMTP-host gezet maar wachtwoord ontbreekt (contact.secret.php of BIDMIND_SMTP_PASSWORD?)');
    http_response_code(500);
    $payload = ['ok' => false, 'error' => 'smtp_password_missing'];
    if (!empty($MAIL_CONFIG['debug'])) {
        $payload['detail'] = 'Vul smtp.password in contact.secret.php of zet BIDMIND_SMTP_PASSWORD op de server.';
    }
    echo json_encode($payload);
    exit;
} else {
    $headers = implode("\r\n", [
        'From: ' . $fromEmail,
        'Reply-To: ' . $email,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'X-Mailer: PHP/' . PHP_VERSION,
    ]);
    $sent = @mail($to, $subject, $body, $headers);
}

if ($sent) {
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(500);
$payload = ['ok' => false, 'error' => 'send'];
if (!empty($MAIL_CONFIG['debug']) && $lastMailError !== null) {
    $payload['detail'] = $lastMailError;
}
echo json_encode($payload);
