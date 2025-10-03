# Contributing to BugSpotter

Thank you for your interest in contributing to BugSpotter! This document provides guidelines and instructions for contributing.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug, please create an issue with:
- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Environment details** (browser, OS, Node version)
- **Screenshots** if applicable
- **Error messages** or console logs

### Suggesting Features

Feature requests are welcome! Please:
- **Check existing issues** to avoid duplicates
- **Describe the use case** - why is this needed?
- **Provide examples** of how it would work
- **Consider alternatives** you've thought about

### Pull Requests

We love pull requests! Here's how to contribute code:

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub
   git clone https://github.com/YOUR_USERNAME/bugspotter.git
   cd bugspotter
   ```

2. **Set up development environment**
   ```bash
   # Install dependencies
   pnpm install
   
   # Build the SDK
   cd packages/sdk
   pnpm run build
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   # or
   git checkout -b fix/bug-description
   ```

4. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add tests for new features
   - Update documentation as needed

5. **Test your changes**
   ```bash
   # Run all tests
   cd packages/sdk
   pnpm test
   
   # Tests should pass: 129/129 ✅
   ```

6. **Build and verify**
   ```bash
   # Build the SDK
   pnpm run build
   
   # Test in demo
   cd ../../apps/demo
   npx browser-sync start --config bs-config.json
   ```

7. **Commit your changes**
   ```bash
   # Use conventional commits
   git commit -m "feat: add amazing feature"
   git commit -m "fix: resolve bug with widget"
   git commit -m "docs: update API documentation"
   ```

8. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   # Then create a Pull Request on GitHub
   ```

## 📝 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Build process, dependencies, etc.
- `perf:` - Performance improvements

### Examples
```bash
feat(sdk): add screenshot compression
fix(modal): prevent close on outside click
docs(readme): add installation instructions
test(network): add XHR interception tests
refactor(capture): improve error handling
chore(deps): update html-to-image to v1.11.13
```

## 🧪 Testing Guidelines

### Running Tests

```bash
# Run all tests
cd packages/sdk
pnpm test

# Watch mode
pnpm test --watch

# UI mode (interactive)
pnpm test --ui

# Coverage report
pnpm test --coverage
```

### Writing Tests

All new features should include tests:

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Coverage

- **Unit tests** for individual functions/classes
- **Integration tests** for component interactions
- **E2E tests** for full workflows (future)
- Aim for **80%+ coverage** on new code

## 💻 Code Style

### TypeScript

- Use **TypeScript** for all new code
- Enable **strict mode** type checking
- Add **type annotations** for public APIs
- Use **interfaces** for data structures

```typescript
// Good
interface UserData {
  id: string;
  name: string;
  email: string;
}

function processUser(user: UserData): string {
  return `${user.name} <${user.email}>`;
}

// Bad (missing types)
function processUser(user) {
  return `${user.name} <${user.email}>`;
}
```

### JavaScript

- Use **ES6+** features (const/let, arrow functions, etc.)
- Use **async/await** for asynchronous code
- Prefer **functional** over imperative when appropriate

```javascript
// Good
const users = await fetchUsers();
const names = users.map(u => u.name);

// Bad
var users = fetchUsers().then(function(users) {
  var names = [];
  for (var i = 0; i < users.length; i++) {
    names.push(users[i].name);
  }
  return names;
});
```

### Formatting

We use Prettier for consistent formatting:

```bash
# Format is automatic on commit
# Or manually:
pnpm prettier --write .
```

### Linting

We use ESLint for code quality:

```bash
pnpm eslint .
```

## 📁 Project Structure

```
bugspotter/
├── packages/
│   ├── sdk/              # Core SDK
│   │   ├── src/          # Source code
│   │   │   ├── index.ts
│   │   │   ├── capture/  # Capture modules
│   │   │   └── widget/   # UI components
│   │   ├── tests/        # Test files
│   │   └── dist/         # Build output
│   └── backend/          # Mock API server
├── apps/
│   └── demo/             # Demo application
├── docs/                 # Documentation
└── scripts/              # Build scripts
```

## 🎯 Development Workflow

### 1. Local Development

```bash
# Terminal 1: Watch mode for SDK
cd packages/sdk
pnpm run dev

# Terminal 2: Run tests in watch mode
pnpm test --watch

# Terminal 3: Run demo
cd ../../apps/demo
npx browser-sync start --config bs-config.json
```

### 2. Testing Changes

```bash
# Run full test suite
cd packages/sdk
pnpm test

# Build production bundle
pnpm run build

# Test in demo
cd ../../apps/demo
# Open http://localhost:3000 and test manually
```

### 3. Documentation

Update documentation when:
- Adding new features
- Changing APIs
- Fixing bugs that affect usage
- Adding examples

Files to update:
- `README.md` - Main project docs
- `packages/sdk/README.md` - SDK API docs
- `docs/*.md` - Specialized guides
- `CHANGELOG.md` - Track changes

## 🐛 Debugging

### SDK Debugging

```javascript
// Enable verbose logging
const bugSpotter = BugSpotter.BugSpotter.init({
  // ... config
});

// Check captured data
const report = await bugSpotter.capture();
console.log('Screenshot:', report.screenshot.substring(0, 50));
console.log('Console logs:', report.console);
console.log('Network:', report.network);
console.log('Metadata:', report.metadata);
```

### Test Debugging

```typescript
// Use .only to focus on one test
it.only('should debug this test', () => {
  console.log('Debug output');
  expect(true).toBe(true);
});
```

### Browser DevTools

- **Console** - Check for errors
- **Network** - Inspect API calls
- **Application** - Check localStorage
- **Elements** - Inspect Shadow DOM

## 📚 Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Webpack Documentation](https://webpack.js.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## ❓ Questions?

- Create a [GitHub Discussion](https://github.com/apexbridge-tech/bugspotter/discussions)
- Check existing [Issues](https://github.com/apexbridge-tech/bugspotter/issues)
- Email: support@apexbridge.tech

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to BugSpotter! 🎉
