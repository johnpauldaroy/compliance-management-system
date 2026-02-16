You are a Senior Solutions Architect + Full-Stack Engineer.
Design and implement a Compliance Management System (CMS) for a cooperative.

This system is already in production intent (not a proposal).
Make reasonable assumptions when necessary and document them without blocking.

1. Tech Stack (MANDATORY)
Frontend

React (TypeScript)

Vite

React Router

TanStack Query

Tailwind CSS

shadcn/ui

Axios (typed client)

Backend

PHP Laravel (latest stable)

REST API

Laravel Sanctum (SPA auth)

Spatie Laravel Permission (RBAC)

Laravel Queue + Scheduler

MySQL (preferred)

Storage & Infra

File uploads: Laravel public storage (dev), S3-compatible (prod-ready)

Email: SMTP

Redis for queues

Dockerized local setup

2. RBAC — FINAL (ONLY 3 ROLES)
1️⃣ Super Admin

Full system control including Audit Trail.

Permissions:

Full CRUD on all entities

Assign PICs, change deadlines, approve/reject uploads

View all dashboards and reports

Manage users and roles

View Audit Trail (exclusive)

Export all data

2️⃣ Compliance & Admin Specialist

Full operational control EXCEPT Audit Trail.

Permissions:

Full CRUD: Agencies, Requirements, Assignments, Uploads

Assign PICs, set/update deadlines

Approve/reject uploads with remarks

Manage reminders and reports

Cannot view audit logs

Cannot manage Super Admin role

3️⃣ Person-In-Charge (PIC) / Branch User

Strictly limited, assignment-based.

Permissions:

View only requirements assigned to them

Upload compliance documents

View their own upload history

View their own compliance status

No approval, no edits, no reports, no audit access

3. CORE RULE (CRITICAL)

One Requirement can have MULTIPLE PICs.
Compliance status is PER PIC, not shared.

Each PIC sees their own compliance status, even if assigned to the same requirement.

4. DATA MODEL (REQUIRED)
A. agencies

id

agency_id (unique)

name

timestamps

B. requirements (MASTER DEFINITION — NO COMPLIANCE STATE)

id

req_id (unique)

agency_id (FK)

category

requirement

description

frequency

schedule

timestamps

❌ DO NOT STORE:

assigned_to

compliance_status

PIC data

C. requirement_assignments (PER-PIC COMPLIANCE)

id

assignment_id (unique)

requirement_id (FK)

assigned_to_user_id (FK → users.id)

deadline (date)

compliance_status (PENDING, SUBMITTED, APPROVED, REJECTED, OVERDUE)

last_submitted_at

last_approved_at

timestamps

Rules:

unique(requirement_id, assigned_to_user_id)

D. uploads

id

upload_id (unique)

assignment_id (FK)

doc_file (path)

uploaded_by_user_id (FK)

uploader_email

upload_date

comments

approval_status (PENDING, APPROVED, REJECTED)

status_change_on

admin_remarks

upload_year

timestamps

E. users

id

user_id (unique)

email (unique)

employee_name

branch

password

timestamps

RBAC handled via Spatie roles.

F. audit_logs (SUPER ADMIN ONLY)

id

actor_user_id

action

entity_type

entity_id

before_json

after_json

ip_address

user_agent

created_at

5. BUSINESS LOGIC (MANDATORY)
Compliance Status Lifecycle (PER ASSIGNMENT)

Default → PENDING

PIC uploads → SUBMITTED

Admin approves → APPROVED

Admin rejects → REJECTED

Deadline passed & not approved → OVERDUE

Upload Rules

PIC can upload only for their own assignment

Admin/Super Admin can approve/reject

Rejection requires remarks

Never overwrite files

6. REMINDERS & AUTOMATION
Reminder Schedule

Send emails when deadline is:

D-30, D-14, D-7, D-1

Rules:

Only if compliance_status ≠ APPROVED

One reminder per assignment per offset

Recipient: assigned PIC

Use Laravel Scheduler + Queue.

7. BACKEND ARCHITECTURE

Use Form Requests for validation

Use Policies for ALL access control

Use Transactions for:

approvals

deadline changes

Centralized error handling

API Resources for consistent responses

Required Policies

RequirementPolicy

RequirementAssignmentPolicy

UploadPolicy

AuditLogPolicy (Super Admin only)

8. FRONTEND ARCHITECTURE
Pages

Login

Dashboard

Agencies

Requirements

Requirement Detail (Admin)

My Requirements (PIC)

Uploads

Approvals (Admin)

Users (Admin)

Audit Trail (Super Admin only)

Reports

UI Rules

Role-based navigation

Dashboard metrics:

SUPER ADMIN / ADMIN: system-wide

PIC: only own assignments

Tables with:

pagination

filtering

sorting

Upload history timeline per assignment

9. SECURITY & GUARDRAILS

Backend authorization is source of truth

PIC cannot:

see other PIC assignments

approve uploads

edit requirements

Audit Trail endpoints blocked except Super Admin

File type + size validation

Rate-limit auth & uploads

10. REPORTING & EXPORTS

Compliance per agency

Compliance per PIC

Overdue assignments

Export CSV / XLSX

Scope enforced by role

11. IMPLEMENTATION ORDER (MANDATORY)

Final DB schema

API contract

Laravel backend (auth + RBAC)

Requirement + Assignment modules

Upload & approval flow

Scheduler & reminders

React frontend

Reports & exports

Hardening + tests

12. OUTPUT REQUIREMENTS

Deliver:

Complete Laravel project

Complete React project

Docker setup

Seeder for roles + Super Admin

Setup & run documentation

If anything is ambiguous, document assumptions and proceed.