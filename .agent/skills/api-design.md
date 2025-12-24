# API Design Principles Skill

Master REST and GraphQL API design to build intuitive, scalable, and maintainable APIs.

## When to Use

- Designing new REST or GraphQL APIs
- Refactoring existing APIs for better usability
- Establishing API design standards
- Reviewing API specifications
- Creating developer-friendly API documentation

## REST Design Principles

### Resource-Oriented Architecture
- Resources are nouns (users, orders, products), not verbs
- Use HTTP methods for actions
- URLs represent resource hierarchies
- Consistent naming conventions

### HTTP Methods
- `GET`: Retrieve resources (idempotent, safe)
- `POST`: Create new resources
- `PUT`: Replace entire resource (idempotent)
- `PATCH`: Partial resource updates
- `DELETE`: Remove resources (idempotent)

### URL Patterns
```
# Good: Resource-oriented endpoints
GET    /api/users              # List users
POST   /api/users              # Create user
GET    /api/users/{id}         # Get specific user
PUT    /api/users/{id}         # Replace user
PATCH  /api/users/{id}         # Update user fields
DELETE /api/users/{id}         # Delete user

# Nested resources
GET    /api/users/{id}/orders  # Get user's orders
POST   /api/users/{id}/orders  # Create order for user

# Bad: Action-oriented (avoid)
POST   /api/createUser
POST   /api/getUserById
```

### Pagination
Always paginate large collections:
- `page` and `page_size` parameters
- Return total count and page info
- Cap max page size (e.g., 100)

### Status Codes
- `200` Success
- `201` Created
- `204` No Content (successful delete)
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `422` Unprocessable Entity (validation error)
- `500` Internal Error

### Error Response Format
```json
{
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": {
    "errors": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

## GraphQL Design Principles

### Schema-First Development
- Types define your domain model
- Queries for reading data
- Mutations for modifying data
- Subscriptions for real-time updates

### Pagination Pattern (Relay-style)
```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### N+1 Prevention
Use DataLoaders to batch requests:
- Load multiple users in single query
- Map results back to input order
- Cache within request context

## API Versioning

### URL Versioning (Recommended)
```
/api/v1/users
/api/v2/users
```

### Header Versioning
```
Accept: application/vnd.api+json; version=1
```

## Best Practices

### REST APIs
1. Use plural nouns for collections (`/users`, not `/user`)
2. Stateless requests
3. Use HTTP status codes correctly
4. Version your API from day one
5. Always paginate large collections
6. Protect with rate limits
7. Use OpenAPI/Swagger for docs

### GraphQL APIs
1. Design schema before writing resolvers
2. Use DataLoaders for N+1 prevention
3. Validate at schema and resolver levels
4. Return structured errors in mutations
5. Use cursor-based pagination
6. Use `@deprecated` for gradual migration
7. Track query complexity

## Common Pitfalls

- Over-fetching/Under-fetching
- Breaking changes without versioning
- Inconsistent error formats
- Missing rate limits
- Poor documentation
- POST for idempotent operations
- API structure mirroring database schema
