# E-mail instellen (BidMind website)

Demo-aanvragen komen binnen op **info@bidmind.nl** (tenzij je `CONTACT_EMAIL` of `BIDMIND_MAIL_TO` aanpast), onderwerp: *Demo-aanvraag www.bidmind.nl*.

## Vercel (productie)

Het contactformulier roept **`/api/contact`** aan (zie `api/contact.js`). In het Vercel-dashboard: **Project → Settings → Environment Variables**.

### SMTP van je domein (Strato / eigen mailserver)

Zet deze variabelen (zoals in Vercel vaak genoemd: `SMTP_*`, `CONTACT_EMAIL`, `FROM_EMAIL`). Geen `contact.secret.php` op Vercel nodig.

**Belangrijk:** de naam van het wachtwoord moet exact kloppen: gebruik **`SMTP_PASS`** (underscore), niet `SMTP-PASS`. Als je per ongeluk een koppelteken hebt gebruikt, werkt het sinds een recente update ook met `SMTP-PASS`. Minimaal nodig voor Strato: **`SMTP_PASS`** + **`SMTP_USER`** (mailbox + wachtwoord). `SMTP_HOST` hoeft niet als je Strato gebruikt: standaard is dan `smtp.strato.de` (zelfde als `contact.php`). Bij een **andere** SMTP-provider moet je `SMTP_HOST` (en poort) wél zetten.

**Preview-deployments:** environment variables staan per omgeving. Test je op een Vercel-preview-URL? Zet dezelfde variabelen ook voor **Preview** (niet alleen Production), of kopieer ze.

| Variabele | Voorbeeld |
|-----------|-----------|
| `CONTACT_EMAIL` | `info@bidmind.nl` (waar de demo-aanvragen binnenkomen) |
| `FROM_EMAIL` | `info@bidmind.nl` (afzender; liefst dezelfde mailbox/domein als bij je provider) |
| `SMTP_HOST` | `smtp.strato.de` (optioneel bij Strato; default in `api/contact.js`) |
| `SMTP_PORT` | `465` of `587` |
| `SMTP_USER` | volledig e-mailadres mailbox |
| `SMTP_PASS` | mailbox-wachtwoord (ook: `BIDMIND_SMTP_PASSWORD`, `SMTP_PASSWORD`) |

Optioneel: `SMTP_ENCRYPTION` — `ssl` (465) of `tls` (587). Als je dit weglaat, kiest `api/contact.js` op basis van de poort (587 → tls, anders ssl).

Ook geldig (legacy, zelfde betekenis): `BIDMIND_MAIL_TO`, `BIDMIND_MAIL_FROM`, `BIDMIND_SMTP_HOST`, `BIDMIND_SMTP_PORT`, `BIDMIND_SMTP_USER`, `BIDMIND_SMTP_PASSWORD`, `BIDMIND_SMTP_ENCRYPTION`.

Optioneel: `SMTP_RELAX_SSL=true` of `BIDMIND_SMTP_RELAX_SSL=true` bij certificaatproblemen (minder veilig).  
Optioneel: `BIDMIND_DEBUG=true` tijdelijk — bij fouten krijgt het JSON-antwoord een veld **`detail`** (alleen voor troubleshooting).

**Build:** Vercel voert `npm install` uit; `package.json` bevat `nodemailer` voor SMTP. Er is geen Prisma in dit project.

### Klassieke PHP-hosting (zonder Vercel)

Blijf **`contact.php`** + **`contact.secret.php`** gebruiken. Zet in `app.js` dan `CONTACT_API_URL` terug naar `'contact.php'` en gebruik weer `FormData` in `postContactForm` zoals voorheen, of serveer de site alleen vanaf Vercel.

## Strato (aanbevolen: SMTP met login)

Strato staat **geen** willekeurige externe SMTP-servers toe vanuit PHP-scripts. Je moet **`smtp.strato.de`** gebruiken met **authenticatie** (volledig e-mailadres + wachtwoord van die mailbox). Zie ook [Strato FAQ: e-mail uit CGI/PHP](https://www.strato.de/faq/mail/e-mail-versand-aus-cgi-und-php-skripten/).

1. Open **`contact.php`** en controleer:
   - **`to`** — waar de meldingen binnenkomen  
   - **`from`** — bestaand adres op je domein (liefst dezelfde mailbox als je voor SMTP gebruikt)  
   - **`smtp.username`** — zelfde mailbox (bijv. `info@bidmind.nl`)  
   - **`smtp.password`** — leeg laten en in **`contact.secret.php`** zetten (veiliger)

2. Kopieer **`contact.secret.php.example`** naar **`contact.secret.php`**, vul het mailbox-wachtwoord in.

3. Upload naar je webspace **o.a.**:
   - `index.html`, `app.js`, `style.css`
   - `contact.php`
   - `contact.secret.php` (alleen op de server)
   - de map **`vendor/phpmailer/`** (volledige inhoud, zoals in dit project)

Typische SMTP-waarden bij Strato:

| Veld | Waarde |
|------|--------|
| Host | `smtp.strato.de` (niet `.com`) |
| Poort | Standaard in `contact.php`: **465** + **ssl**; script probeert automatisch **587** + **tls** als de eerste poging faalt |
| Gebruikersnaam | je volledige e-mailadres |
| Wachtwoord | in `contact.secret.php`, of server-omgeving **`SMTP_PASS`** of **`BIDMIND_SMTP_PASSWORD`** (als `contact.secret.php` geen wachtwoord heeft) |

Bij foutmeldingen over TLS/certificaat: in `contact.secret.php` onder `smtp` kun je tijdelijk **`'relax_ssl' => true`** zetten (alleen als nodig).

## Zonder SMTP-wachtwoord

Als **`smtp.host`** is ingevuld (standaard: Strato) maar **`smtp.password`** leeg is, stuurt het script **geen** `mail()` meer — je krijgt een duidelijke fout (`smtp_password_missing`). Vul het wachtwoord in **`contact.secret.php`** op de server.

Als je **`smtp.host`** leeg maakt, valt het script terug op PHP **`mail()`** (alleen zinvol op hostings waar dat wél werkt).

**Let op:** de SMTP-host van Strato is **`smtp.strato.de`** (niet `.com`).

## Fouten zichtbaar maken (debug)

1. **Serverlog:** bij SMTP-problemen schrijft PHP een regel naar de errorlog: `[contact.php] SMTP: …` — in Strato Klantenlogin onder logging / PHP-errorlog.
2. **In de browser:** zet tijdelijk in **`contact.secret.php`** `'debug' => true`. Bij status 500 bevat het JSON-antwoord dan **`detail`** met de SMTP-fouttekst. **Zet debug daarna weer uit** (geen gevoelige info blootstellen).

## Als er geen mail aankomt

1. Kloppen `from` en `smtp.username` met een **echte** mailbox in Strato?  
2. Staat **`vendor/phpmailer/phpmailer/src/`** op de server (met o.a. `PHPMailer.php`)?  
3. Juiste poort/encryptie: 587 + tls of 465 + ssl.  
4. Spamfolder en mailboxquotum controleren.  
5. Formulier testen op **https://jouwdomein.nl/** (niet lokaal als `file://`).
