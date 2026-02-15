Feature: Oracle backend core workflows
  As an Oracle dashboard operator
  I want backend endpoints and data flows to behave consistently
  So I can trust analytics, admin operations, and security controls.

  Scenario: Ingest pipeline writes data and summary reflects results
    Given Oracle backend is running with a valid ingest secret
    When a valid ingest batch is sent to /ingest-batch
    Then the API responds with 200 OK
    And the batch is stored once using batchId idempotency
    And /api/stats/summary shows non-zero totals

  Scenario: Auth-gated dashboard API access
    Given dashboard password auth is enabled
    When a client requests /api/stats/summary without a session
    Then the API responds with 401 Unauthorized
    When the client logs in with valid credentials via /api/auth/login
    Then a valid oracle_session cookie is issued
    And authenticated requests to /api/stats/summary return 200 OK

  Scenario: Newsletter subscriber management
    Given creative hub feature is enabled
    When an operator upserts a subscriber with email USER@Example.COM
    Then the stored email is normalized to user@example.com
    And listing /api/admin/newsletter/subscribers returns that record
    When the same subscriber is upserted again with updated metadata
    Then only one subscriber record exists for that email

  Scenario: SQL safety guard rails
    Given SQL console feature is enabled for admin usage
    When a query references restricted tables using quoted identifiers
    Then /api/admin/sql/query returns 400 Bad Request
    And no restricted table data is returned

  Scenario: Oracle operation logs retention controls
    Given operation logs exist in oracle_operation_logs
    When delete-older runs in dry-run mode
    Then the response includes wouldDelete without deleting rows
    When delete-older runs without dry-run
    Then rows older than the requested window are removed
