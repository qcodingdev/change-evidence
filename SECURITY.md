# Security Policy

Change Evidence runs locally and analyzes local git diffs. It should not send code, diffs, or secrets to remote services.

## Reporting A Vulnerability

Please do not report security issues by opening a public issue if the report contains sensitive details.

Use GitHub private vulnerability reporting if it is enabled for this repository. If it is not enabled, open a minimal public issue asking for a private contact path, without including exploit details, secrets, private code, or sensitive logs.

## Secret Handling

Change Evidence detects sensitive keywords and redacts secret-looking values before rendering reports. If you find a case where a secret value is printed, please report it privately.

When sharing examples, always replace real values with placeholders:

```text
api_key = ***REDACTED***
token = ***REDACTED***
password = ***REDACTED***
```

## Supported Versions

Security fixes are currently provided for the latest released version.
