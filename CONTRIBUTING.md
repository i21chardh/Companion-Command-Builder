# Contributing

Bug reports should include:

- CCB and Bitfocus Companion versions
- Stream Deck model and selected surface/layer
- Companion module ID and version
- The exact prompt that failed
- Expected and actual behavior
- Sanitized system-log details when available

Before submitting a code change, run:

```sh
npm test
npm run audit:stress
```

New parser behavior should include a deterministic test and a permanent stress-audit case. Never commit credentials, private Companion exports, production IP addresses, or generated application archives.
