# Gift Hunter

A single-user shopping desk for the people you buy for. It keeps their likes, dislikes, hobbies, and budget, watches occasions, and ranks Rakuten deals by what you actually pay after cashback.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` creates the SQLite database, loads sample people when the database is empty, and serves the app at [http://127.0.0.1:4317](http://127.0.0.1:4317).

Copy `.env.example` to `.env` first if you do not already have one. The sample catalog is the default, so the app is usable before you add Rakuten or email credentials.

Reset the sample data with `npm run db:reset`.

## What you can do

- Add and edit people: name, relationship, likes, dislikes, hobbies, a budget in US dollars, and an optional email. A missing name, a negative budget, or a non-numeric budget is rejected. A blank email is fine; a malformed one is not. The address is only for your reference. Digests still go to `DIGEST_TO` or `OWNER_EMAIL`, never to the person.
- Add occasions: birthday, anniversary, Teachers' Day, holiday, custom event, or an ad-hoc need (free text, optional deadline).
- Search on demand. An ad-hoc need is one request: `POST /api/people/:id/search` with `{ "need": "winter boots", "deadline": null }` returns the deals.
- Read price, cashback percent, and effective price on every deal. Effective price is price minus Rakuten cashback. The list is sorted by effective price, lowest first. Preference score breaks ties. Favorites stay pinned. Dismissed links stay hidden.
- Up to 5 deals are shown (`MAX_DEALS`). If nothing fits, the page says **No matches within budget**.
- Mark an occasion complete by picking a suggested deal, typing a purchase, or choosing **no gift**. The history timeline keeps the purchase.
- Birthdays, anniversaries, Teachers' Day, and holidays repeat every year. Completing one rolls it to next year. An overdue date does not skip ahead until you complete it. February 29 is shown as February 28 in non-leap years and February 29 in leap years. Ad-hoc needs close when completed and do not roll.
- The home page lists every active person's open occasions, sorted by date, with **Today**, **N days**, or **Overdue by N days**. The people list shows hobbies and the next occasion. Days are calendar days in `OWNER_TIMEZONE`.
- Archive someone to hide them from lists and digests. Archive and restore are safe to repeat. Restore brings back the person, their occasions, and their purchases unchanged. There is no permanent delete.
- Digests go out when an open occasion is inside the lead window (default 14 days, `DIGEST_LEAD_DAYS`), once per occurrence. Completed occasions and archived people are skipped. Running the job again the same day does not send a duplicate.

## How matching works

Gift searches use likes and hobbies (and a specific occasion name, such as a holiday). Ad-hoc searches use the need you typed, and still apply the budget and dislikes.

A deal is kept only when:

- its effective price is within the budget (an occasion budget overrides the person's default when you set one)
- no dislike phrase appears in the **title or category**
- it actually matches a like, hobby, or the ad-hoc request

Dislikes are whole words or phrases, with a simple plural (`mugs` matches `mug`). A dislike that shows up only in the description does not remove the deal.

Score is used only to order two deals with the same effective price. It is higher when the match is in the title than when it is only in the description.

If the feed has no merchant name, the card and the email both say **Unknown store**.

## Rakuten credentials

The legitimate source for US product data is [Rakuten Advertising](https://rakutenadvertising.com)'s Product Search API (the affiliate network behind Rakuten.com), not a scrape of the website and not the Japan Ichiba API.

1. Open a publisher account at [rakutenadvertising.com](https://rakutenadvertising.com) and sign in to the Publisher Dashboard.
2. Join the advertiser programs you want. Product Search only returns products from advertisers you have partnered with. Rakuten.com itself may be one of those advertisers.
3. Open the [Developer Portal](https://developers.rakutenadvertising.com/) with the same dashboard login and create an application. That gives you a client id and client secret.
4. Copy your publisher account id (SID). The app sends it as the OAuth `scope`.
5. Put them in `.env` and restart:

```bash
RAKUTEN_CLIENT_ID="..."
RAKUTEN_CLIENT_SECRET="..."
RAKUTEN_ACCOUNT_ID="..."
```

If those values are missing, the app logs `Falling back to the mock deal provider` and uses the sample catalog. It does not call Rakuten.

Optional:

- `RAKUTEN_ACCESS_TOKEN` skips the token request if you already generated one in the portal.
- `RAKUTEN_USERNAME` and `RAKUTEN_PASSWORD` use the older password grant. Otherwise the app uses `client_credentials`.
- `RAKUTEN_TOKEN_AUTH=bearer` (the default) sends `Authorization: Bearer base64(client_id:client_secret)` on the token call, which is what Rakuten's guide specifies. Set it to `basic` if your app expects HTTP Basic.
- `RAKUTEN_TOKEN_URL` defaults to `https://api.rakutenmarketing.com/token`.
- `RAKUTEN_SEARCH_URL` defaults to `https://api.rakutenmarketing.com/productsearch/1.0`.
- `RAKUTEN_MID` limits results to one advertiser id.
- The documented response is XML. The rate limit published for the API is 100 calls per minute. Cashback percent is not part of that documented schema; if a feed includes a `cashback` element it is used, otherwise the rate is 0 and effective price equals the selling price. The sample catalog includes cashback so the math is visible without credentials.

Do not scrape rakuten.com. The affiliate API is the supported path, and the links it returns are affiliate links.

## Email

`EMAIL_PROVIDER=log` (the default) prints the digest and saves it under Digests. The log includes the recipient, subject, and body, and every deal line names the store.

To send mail, set either SMTP (`EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) or Resend (`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`). Set `EMAIL_FROM` and `DIGEST_TO` either way.

If SMTP or Resend is selected but the host or key is missing, the app logs the message instead. The in-process scheduler checks every `SCHEDULER_INTERVAL_MINUTES` (default 360). Set `SCHEDULER_ENABLED=false` to turn that off. You can also POST `/api/cron/upcoming` with `Authorization: Bearer $CRON_SECRET`.

## Tests

```bash
npm test
```

The acceptance tests live in `tests/acceptance.test.ts` and are named by id, AC-1 through AC-27. AC-25 is archive and restore. AC-26 is the store name. AC-27 is the optional per-person email: reference only (not used for sending), validated when present, empty allowed, trimmed. Removal is archive, not delete: AC-2 covers occasion types, and AC-25 covers what happens to those occasions when a person is archived.
