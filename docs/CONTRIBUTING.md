# Contributing to MORTIS

Thank you for your interest in contributing to MORTIS.

## Getting Started

### Prerequisites

- Rust 1.75.0+ (stable)
- Git
- (Optional) cargo-audit, cargo-deny, cargo-cyclonedx

### Setup

```bash
git clone https://github.com/knarayanareddy/MORTIS.git
cd MORTIS
cargo build
cargo test
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Follow the coding standards below.

### 3. Run Tests

```bash
# All tests
cargo test

# Specific crate
cargo test -p mortis-crypto

# E2E tests
cargo test --test e2e

# With output
cargo test -- --nocapture
```

### 4. Check Quality

```bash
# Lint
cargo clippy -- -D warnings

# Format
cargo fmt --check

# Audit
cargo audit

# License check
cargo deny check
```

### 5. Submit PR

- PR description must explain what and why
- All CI checks must pass
- DRI must approve changes to §CANONICAL sections

## Coding Standards

### Rust Style

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- No `unwrap()` in production code (use `?` or `expect()`)
- No `unsafe` blocks without DRI approval

### Error Handling

```rust
// Good
fn do_thing() -> Result<()> {
    let value = get_value()?;
    Ok(())
}

// Bad
fn do_thing() {
    let value = get_value().unwrap();
}
```

### Documentation

- All public items must have doc comments
- Use `///` for items, `//!` for modules
- Include examples for complex functions

```rust
/// Derive an encryption key from a passphrase and salt.
///
/// # Arguments
/// * `passphrase` - User-supplied passphrase
/// * `salt` - 32-byte random salt
///
/// # Returns
/// Derived key (zeroized on drop)
///
/// # Example
/// ```
/// let salt = generate_salt();
/// let key = derive("my-passphrase", &salt)?;
/// ```
pub fn derive(passphrase: &str, salt: &[u8]) -> Result<DerivedKey, KeyError> {
    // ...
}
```

### Testing

- Unit tests in each module
- Integration tests in `tests/` directory
- Property tests via `proptest` for critical logic
- E2E tests for CLI commands

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = do_thing();
        assert!(result.is_ok());
    }

    #[test]
    fn error_case() {
        let result = do_thing_with_bad_input();
        assert!(result.is_err());
    }
}
```

### Commit Messages

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(crypto): add RFC 3161 timestamp support
fix(orchestrator): handle plugin panic correctly
docs(readme): update installation instructions
test(receipt): add tamper detection tests
```

## Architecture Decisions

### §CANONICAL Sections

Changes to these sections require DRI approval:

| Section | What It Governs |
|---------|-----------------|
| Appendix A | Inventory DB schema |
| Appendix B | Receipt JSON schema |
| Appendix C | Sanitization method matrix |
| Appendix D | Threat/mitigation table |
| §5.2 | Plugin trait signatures |
| §7 | Cryptographic primitive selections |

### Exception Process

Any deviation from a §CANONICAL section requires:
1. Written justification in PR description
2. DRI approval
3. Update to the §CANONICAL section in the same PR

## Adding a Plugin

### 1. Create Plugin Struct

```rust
pub struct MyPlugin;
```

### 2. Implement Trait

```rust
#[async_trait]
impl SanitizationPlugin for MyPlugin {
    fn name(&self) -> &str {
        "MyPlugin"
    }

    fn supported_media_types(&self) -> &[MediaType] {
        &[MediaType::Generic]
    }

    async fn sanitize(
        &self,
        asset: &Asset,
        method: &SanitizationMethod,
        dry_run: bool,
    ) -> Result<SanitizationResult, SanitizationError> {
        // Implementation
    }
}
```

### 3. Add Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_my_plugin() {
        let plugin = MyPlugin;
        let asset = create_test_asset();
        let result = plugin.sanitize(
            &asset,
            &SanitizationMethod::OverwriteRandom,
            true, // dry_run
        ).await.unwrap();
        assert!(result.success);
    }
}
```

### 4. Register in Orchestrator

```rust
orch.add_sanitization_plugin(Box::new(MyPlugin));
```

## Adding a Trigger

### 1. Define Trigger Type

```rust
pub enum MyTrigger {
    // ...
}
```

### 2. Implement Evaluation

```rust
fn evaluate(&self, ctx: &TriggerContext) -> TriggerEvaluation {
    TriggerEvaluation {
        should_fire: true,
        confidence: 1.0,
        reason: "my trigger fired".to_string(),
        evaluated_at: ctx.current_time,
    }
}
```

### 3. Add Tests

```rust
#[test]
fn test_my_trigger() {
    let trigger = MyTrigger;
    let ctx = create_test_context();
    let eval = trigger.evaluate(&ctx);
    assert!(eval.should_fire);
}
```

## Security Issues

Report security issues privately to: security@mortis.dev

Do NOT open a public issue for security vulnerabilities.

### What to Report

- Cryptographic weaknesses
- Memory safety issues
- Privilege escalation
- Data leakage
- Denial of service

### Response Timeline

- Acknowledgment: 48 hours
- Triage: 1 week
- Fix: Depends on severity
- Disclosure: Coordinated with reporter

## Release Process

### 1. Version Bump

```bash
# Update version in all Cargo.toml files
# Follow SemVer
```

### 2. Changelog

Update `CHANGELOG.md` with all changes since last release.

### 3. CI Verification

All CI checks must pass:
- Build (Linux/macOS/Windows)
- Tests
- Clippy
- Rustfmt
- cargo-audit
- cargo-deny
- MSRV check
- Reproducible build

### 4. Build Artifacts

```bash
./scripts/build-reproducible.sh
./scripts/generate-sbom.sh
./scripts/sign-release.sh
```

### 5. Publish

```bash
git tag -s v1.0.0
git push origin v1.0.0
```

### 6. Release Notes

Include:
- Changelog
- SBOM link
- Cosign bundle
- Verification instructions
- Migration guide (for MAJOR releases)

## Code of Conduct

- Be respectful
- Be constructive
- Be patient
- Focus on the code, not the person

## License

By contributing, you agree that your contributions will be licensed under Apache-2.0.
