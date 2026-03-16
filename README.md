# scanservjs — Security Hardening (`feature/security`)

> **This is a feature branch** of [Markus Gutschke's community fork](https://github.com/gutschke/scanservjs)
> of [sbs20/scanservjs](https://github.com/sbs20/scanservjs).
>
> For the full feature set and a pre-built Debian/Ubuntu package, see the
> [`production` branch](https://github.com/gutschke/scanservjs/tree/production) or the
> [`binary` branch](https://github.com/gutschke/scanservjs/tree/binary).

## Security Hardening

Addresses a set of security weaknesses in the upstream codebase:

- **Input validation**: All user-supplied filenames and parameters are validated and
  sanitised before use in shell commands or filesystem operations.
- **Path containment**: File access is restricted to the configured output and temp
  directories; traversal attempts (`../`) are rejected.
- **HTTP security headers**: Helmet is added with a Content Security Policy,
  `X-Frame-Options: sameorigin`, and other standard hardening headers.
- **Prototype pollution guard**: Denies query/body keys that would shadow Object
  prototype properties.

This branch is the **common base** for all other feature branches in this fork.
Every feature branch is rebased onto `feature/security` rather than `master` directly.
