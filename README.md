# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

# Testing

This project includes several types of tests:

- Unit tests (Jest) for utility functions
- Integration tests (Jest + React Testing Library) for React components
- E2E tests (Playwright) for critical user flows
- Static type tests (tsd) to validate TypeScript types

Run all tests with:
```bash
npm run test
```

Or run specific test suites:
```bash
npm run test:unit         # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e          # E2E tests (ensure the dev server is running on port 9002)
npm run test:types        # Static type tests
```
