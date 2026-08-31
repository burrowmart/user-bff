# user-bff

## Architecture

`user-bff` is a thin REST aggregation BFF for the user-facing client — it
holds **no domain logic and no datastore**. Every request fans out to one or
more domain services via typed `@demo/contracts` clients and reshapes the
result.

- `GET /profile` = `user-service` (the caller's own record, by email from the
  verified JWT) + `notification-service` (`unread-count`), fetched in
  parallel.
- Forwards the caller's own Cognito credential (`cf-token` /
  `x-amzn-oidc-data` / `Authorization`) to both downstream calls — every
  service pod's Envoy PEP verifies the JWT on every route (the app guards
  only extract identity), so a BFF-to-service call without it would be
  denied in a real deployment.
- No writes, no caching (v1), no saga/compensation knowledge.

### Request flow

```
Client → GET /profile
         ↓
ProfileController  (@Claims() → authenticated email; forwards auth header)
         ↓
ProfileService     (Promise.all: user-service + notification-service)
         ↓
user-service GET /users/{email}     notification-service GET /notifications/unread-count
```

---

## Running locally

### Prerequisites

```bash
# 1. Build the shared contracts package (provides DTOs + typed clients)
cd ../contracts && npm install && npm run build && cd -

# 2. Install service dependencies
npm install
cp .env.example .env
```

user-bff has no datastore of its own — it just needs `user-service` and
`notification-service` reachable at the URLs in `.env`.

### Start in dev mode

```bash
npm run start:dev
# Service listens on http://localhost:3000
# Swagger UI at    http://localhost:3000/api
```

### Tests

```bash
npm test       # unit — ProfileService with both downstream clients mocked
npm run test:e2e  # e2e — real HTTP against in-process stubs for both downstream services
```

### curl round-trip

```bash
curl -s http://localhost:3000/profile \
  -H 'Authorization: Bearer <cognito-id-token>' | jq
```
