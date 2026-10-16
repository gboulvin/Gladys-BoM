# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainer for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## What the integration handles

- It stores no secret: the BoM API needs no account and no key.
- It reads the position of your Gladys houses (manifest `"location": true`,
  shown on the install screen) to know which place to monitor, and sends the
  BoM only the 6-character geohash of that position (a cell of about 1 km) or
  the place name you typed.
- It talks to `https://api.weather.bom.gov.au` only, over HTTPS.
- It writes a single file, `/data/bom-state.json` (the warnings already
  announced), in the only writable volume of its container.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the Bureau of Meteorology services the integration reads.
