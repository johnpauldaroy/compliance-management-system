# Compliance Management System — User Manual

**Version:** 1.0
**Last Updated:** May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Role: Super Admin](#2-role-super-admin)
3. [Role: Compliance & Admin Specialist](#3-role-compliance--admin-specialist)
4. [Role: Person-In-Charge (PIC)](#4-role-person-in-charge-pic)
   - [4.1 Getting Started](#41-getting-started)
   - [4.2 My Compliance Requirements Page](#42-my-compliance-requirements-page)
   - [4.3 How Auto-Assign Works](#43-how-auto-assign-works)
   - [4.4 Parallel Mode vs Sequential Mode](#44-parallel-mode-vs-sequential-mode)
   - [4.5 Submitting Documents](#45-submitting-documents)
   - [4.6 Notifications You Will Receive](#46-notifications-you-will-receive)
   - [4.7 Monthly Auto-Advance](#47-monthly-auto-advance)
   - [4.8 Understanding Your Submission Status](#48-understanding-your-submission-status)
   - [4.9 Frequently Asked Questions (PIC)](#49-frequently-asked-questions-pic)
5. [Glossary](#5-glossary)

---

## 1. System Overview

The Compliance Management System (CMS) is a web-based platform that tracks regulatory and internal compliance requirements across agencies. It manages document submissions, assigns responsibilities to staff, and automates recurring compliance cycles.

### Who Uses the System

| Role | Who This Is |
|---|---|
| **Super Admin** | System administrators with full access |
| **Compliance & Admin Specialist** | Staff who create requirements, assign PICs, and review submissions |
| **Person-In-Charge (PIC)** | Staff responsible for uploading compliance documents |

---

## 2. Role: Super Admin

Super Admins have unrestricted access to the entire system. All features available to lower roles are also available to Super Admins.

### What Super Admins Can Do

- Everything a Compliance & Admin Specialist can do
- Create, edit, and deactivate user accounts
- Assign roles to users (Super Admin, Compliance & Admin Specialist, PIC)
- View the full system audit log
- Access all data across all agencies and departments

### When to Use This Role

Use the Super Admin role only for system configuration and user management tasks. For day-to-day compliance work, use the Compliance & Admin Specialist role to reduce risk of unintended changes.

---

## 3. Role: Compliance & Admin Specialist

Compliance & Admin Specialists are responsible for setting up requirements, assigning PICs, reviewing submissions, and monitoring overall compliance health.

### 3.1 Managing Requirements

#### Creating a Requirement

1. Go to **Requirements** in the main navigation.
2. Click **Add Requirement**.
3. Fill in the required fields:
   - **Agency** — The agency the requirement belongs to
   - **Category** — Classification of the requirement
   - **Requirement Name** — A clear, descriptive name
   - **Description** — Optional additional context
   - **Frequency** — How often the requirement recurs (e.g., Monthly, Quarterly, Annual)
   - **Schedule** — The specific schedule or reference period
   - **Deadline** — The due date for the current cycle
4. Choose the **Assignment Mode** — Parallel or Sequential (see Section 4.4 for details)
5. Assign one or more PICs from the user list
6. Click **Save**

> **Note:** Requirements with a **Monthly** frequency will have auto-advance automatically enabled. This means deadlines advance to the next month automatically after all PICs are approved. See Section 4.7 for how PICs experience this.

#### Editing a Requirement

1. Find the requirement in the Requirements list
2. Click the **Edit** icon on the requirement row
3. Modify the fields as needed
4. Click **Save**

> **Important:** Changing the main deadline on a requirement resets all PIC assignment statuses back to **PENDING** for that deadline.

#### Deactivating a Requirement

1. Open the requirement
2. Click **Deactivate**
3. Confirm the action

Deactivated requirements no longer appear in active views but are preserved in history.

### 3.2 Assigning PICs

When creating or editing a requirement, you can assign multiple PICs:

- **Parallel Mode:** All assigned PICs work at the same time. Each PIC gets the same deadline unless you set individual deadlines. The requirement is considered compliant only when all PICs have an approved submission.
- **Sequential Mode:** PICs are assigned a sequence order (1st, 2nd, 3rd, etc.). Only the first PIC can submit initially. Each subsequent PIC is activated only after the previous one is approved.

> You cannot remove a PIC who has a **PENDING** (awaiting approval) submission. Resolve the submission first.

### 3.3 Uploading on Behalf of a PIC

Admins can submit documents on behalf of any PIC:

1. Open the requirement
2. Find the PIC's assignment row
3. Click **Upload** on their row
4. Select files and submit

### 3.4 Reviewing Submissions

1. Go to **Approvals** in the main navigation
2. The list defaults to **PENDING** submissions
3. Click a submission row to view its files
4. Choose **Approve** or **Reject**
   - Approval is optional to annotate with remarks
   - Rejection **requires** remarks explaining what needs to be corrected
5. The PIC receives an email notification with the outcome

### 3.5 Editing Submission Deadlines

If you need to adjust the deadline recorded on a specific submission:

1. Find the submission in the Approvals list
2. Click the deadline field and update it
3. Save the change

### 3.6 Monitoring Compliance

The **Dashboard** provides:
- Overall compliance rate (% of requirements currently complied)
- Breakdown by agency
- Calendar view of upcoming and past deadlines
- Recent activity log

Use the **Requirements** page filters to view:
- **N/A** — No deadline set
- **Pending** — In progress, not yet fully complied
- **Complied** — All PICs approved
- **Overdue** — At least one PIC missed the deadline

### 3.7 Importing Requirements in Bulk

Use the **Import** button on the Requirements page to upload a CSV file with multiple requirements at once. Download the template first to ensure the correct column format.

---

## 4. Role: Person-In-Charge (PIC)

As a PIC, your responsibility is to upload the required compliance documents for the requirements you are assigned to, by the specified deadlines.

---

### 4.1 Getting Started

When you are first assigned to a requirement, you will receive an **email notification** with:
- The name of the requirement
- Your deadline
- A link to the system

Log in at the system URL using your credentials. Your main workspace is the **My Compliance Requirements** page, accessible from the navigation menu.

---

### 4.2 My Compliance Requirements Page

This page is your central hub. It has two tabs:

| Tab | What It Shows |
|---|---|
| **Active** | Requirements you are currently assigned to |
| **History** | Requirements you were previously assigned to but are no longer active on |

#### What Each Row Shows

Each requirement row displays:
- **Requirement Name** and agency
- **Category**
- **Deadline** — Your specific due date for this requirement
- **Status** — Your current compliance status for this cycle
- **Submissions** — All files you have submitted, grouped by deadline

#### Status Indicators

| Status | Meaning |
|---|---|
| **Pending** | You have not yet submitted anything for this deadline |
| **For Approval** | You submitted and are waiting for the admin to review |
| **Complied** | Your submission was approved |
| **Overdue** | The deadline has passed without an approved submission |

---

### 4.3 How Auto-Assign Works

You do not need to request or sign up for requirements. The **Compliance & Admin Specialist assigns you directly** when creating or editing a requirement.

**What happens when you are assigned:**

1. The system immediately creates a compliance assignment record for you
2. You receive an **email notification** with your deadline (see Section 4.6)
3. The requirement appears on your **Active** tab
4. If the assignment is in **Sequential Mode** and you are not the first in sequence, you will see your assignment but cannot upload yet — you will receive a separate notification when your turn becomes active

**When you are removed from a requirement:**
- The assignment moves to your **History** tab
- You can no longer upload to it
- You cannot be removed if you have a submission currently **For Approval** (pending review)

---

### 4.4 Parallel Mode vs Sequential Mode

Your admin chooses one of two modes when setting up a requirement. Understanding which mode applies to you affects when and how you can submit.

---

#### Parallel Mode

**What it means:** All PICs assigned to the requirement can submit at the same time, independently of each other.

**How it works for you:**
- Your assignment is active immediately
- You can upload as soon as you are assigned
- Your deadline may be the same as other PICs, or your admin may give you an individual deadline
- Your submission is reviewed independently
- Other PICs being approved (or not) does not affect your ability to submit

**Example:** Three PICs (A, B, C) are assigned in parallel mode.
- PIC A, B, and C can all upload on the same day
- Each is reviewed separately
- The requirement is fully complied only when all three are approved

---

#### Sequential Mode

**What it means:** PICs are ordered in a chain. Only one PIC is active at a time. Each PIC must be approved before the next one can submit.

**How it works for you:**
- Your assignment has a **sequence order** (e.g., 1st, 2nd, 3rd)
- If you are **1st in sequence**, your assignment is active immediately — you can upload right away
- If you are **2nd or later**, your assignment is on hold until the person before you is approved
- When the previous PIC is approved, you receive an **email notification** telling you it is now your turn
- A badge labeled **ACTIVE** appears next to your assignment on the My Requirements page when it is your turn

**Example:** Three PICs (A → B → C) in sequential mode.
1. PIC A is active first. PIC B and C see their assignments but cannot upload.
2. PIC A submits → Admin approves PIC A → System activates PIC B → PIC B receives email
3. PIC B submits → Admin approves PIC B → System activates PIC C → PIC C receives email
4. PIC C submits → Admin approves PIC C → Requirement is fully complied

> **Tip:** In sequential mode, hovering over a disabled upload button will show a tooltip explaining that you are waiting for a previous PIC to complete.

---

### 4.5 Submitting Documents

#### Before You Submit — Checklist

- [ ] Your assignment is **active** (not waiting in sequential mode)
- [ ] A deadline has been set (if the deadline shows **N/A**, contact your admin)
- [ ] You do not already have a submission **For Approval** for this deadline
- [ ] Your status is not already **Complied** for this deadline

#### How to Upload

1. Go to **My Compliance Requirements**
2. Find the requirement you need to submit for
3. Click the **Upload** button on that row
4. In the upload dialog:
   - **Select Files** — Click to browse or drag and drop files
   - **Accepted formats:** PDF, CSV, XLS, XLSX
   - **Maximum file size:** 250 MB per file
   - **Multiple files** can be uploaded in a single submission
   - **Comments** — Optionally add a note for the admin reviewing your submission
5. Click **Submit**

After submitting, your status changes to **For Approval** and the admin receives a notification.

#### If Your Submission is Rejected

1. You will receive an **email** with the admin's remarks explaining what needs to be corrected
2. Your status resets to **Pending**
3. Review the remarks on your submission (visible in the submissions section of the requirement row)
4. Upload corrected documents using the **Upload** button again

---

### 4.6 Notifications You Will Receive

The system sends you email notifications automatically for the following events. You do not need to check the system constantly — the emails will prompt you when action is needed.

---

#### Notification 1: New Assignment / Deadline Set

**When:** You are assigned to a requirement, or your deadline is updated by an admin.

**What the email tells you:**
- The name of the requirement
- Your deadline
- Any relevant details about the assignment

**What to do:** Log in and submit your documents before the deadline.

---

#### Notification 2: Your Turn is Active (Sequential Mode Only)

**When:** You are assigned in sequential mode and the PIC before you in the sequence has been approved.

**What the email tells you:**
- The requirement name
- That your turn is now active
- Your deadline

**What to do:** Log in immediately and upload your documents. The deadline is now counting down for you.

---

#### Notification 3: Submission Approved

**When:** An admin approves your submission.

**What the email tells you:**
- The requirement name
- That your submission was approved
- Any remarks left by the admin (optional)

**What to do:** No immediate action needed. If this is a monthly requirement, watch for the next cycle notification (see Section 4.7).

---

#### Notification 4: Submission Rejected

**When:** An admin rejects your submission.

**What the email tells you:**
- The requirement name
- That your submission was rejected
- The admin's remarks explaining what needs to be corrected

**What to do:** Log in, review the remarks, and resubmit corrected documents as soon as possible — your deadline is still counting.

---

#### Notification 5: Monthly Deadline Advanced (Monthly Requirements Only)

**When:** After your submission (and all other PICs, if any) is approved, the system automatically advances the deadline to the next month.

**What the email tells you:**
- The requirement name
- That the cycle has advanced
- Your new deadline for the upcoming month

**What to do:** Note the new deadline and prepare to submit again for the new cycle. You do not need to do anything right now unless the new deadline is approaching.

---

### 4.7 Monthly Auto-Advance

For requirements with a **Monthly** frequency, the system automatically resets and advances to the next compliance cycle after all PICs are approved. You do not need to ask your admin to reset anything.

#### How It Works — Step by Step

1. **You and all PICs are approved** for the current month's deadline
2. **The system waits approximately 2 days** after the final approval (to allow admins time to review and make any corrections)
3. **The system checks** whether the deadline has passed
4. **If the deadline has passed**, it advances the deadline to the same day of the next month (e.g., January 31 → February 28)
5. **All PIC assignments reset** to **Pending** status
6. **Email notifications are sent** to the active PIC(s) with the new deadline

#### What Changes After Auto-Advance

| Before Advance | After Advance |
|---|---|
| Status: Complied | Status: Pending |
| Deadline: Jan 31, 2026 | Deadline: Feb 28, 2026 |
| Old submissions preserved | Old submissions preserved (visible in submission history) |
| Cannot re-upload | Upload button becomes active again |

#### In Sequential Mode

When the requirement is in sequential mode, the auto-advance:
- Resets **all** PICs in the sequence back to Pending
- Reactivates the **first PIC in the sequence** for the new cycle
- Sends the deadline notification only to the **first PIC**
- The second, third, etc. PICs will be activated again in order as usual

#### Your Submission History is Preserved

Auto-advance does **not** delete your old submissions. All past submissions remain visible in the requirement row, grouped by the deadline they were submitted for. You can always scroll through your history to see past cycles.

#### Example Timeline (Parallel Mode)

```
Requirement: Monthly Compliance Report
PICs: Alice and Bob (parallel mode)
Current Deadline: January 31, 2026

January 25 → Alice submits, status: For Approval
January 26 → Bob submits, status: For Approval
January 27 → Admin approves Alice's submission
January 28 → Admin approves Bob's submission
             (2-day window begins)
January 30 → System confirms deadline has passed
             Deadline advances to: February 28, 2026
             Alice status resets to: Pending
             Bob status resets to: Pending
             Alice receives email: "New deadline: Feb 28, 2026"
             Bob receives email: "New deadline: Feb 28, 2026"

February 15 → Alice and Bob can now upload for February
```

#### Example Timeline (Sequential Mode)

```
Requirement: Monthly Compliance Sign-off
PICs: Alice (1st) → Bob (2nd) → Carol (3rd)
Current Deadline: January 31, 2026

Jan 20 → Alice submits → Admin approves → Bob activated
Jan 22 → Bob submits → Admin approves → Carol activated
Jan 24 → Carol submits → Admin approves
         (2-day window begins — Carol is last)
Jan 26 → System advances deadline to February 28, 2026
         All statuses reset to Pending
         Alice reactivated as 1st in sequence
         Alice receives email: "New deadline: Feb 28, 2026"
         Bob and Carol wait for Alice to complete first
```

---

### 4.8 Understanding Your Submission Status

#### The Upload Button May Be Disabled

There are several reasons the Upload button might be greyed out:

| Reason | What to Do |
|---|---|
| **No deadline set** | Contact your Compliance & Admin Specialist to set a deadline |
| **Already Complied** | You are approved for this cycle. Wait for the next cycle (if monthly) |
| **For Approval** | Your submission is currently being reviewed. Wait for the admin's decision |
| **Waiting in sequence** | Another PIC must be approved before your turn. Wait for your activation email |
| **Historical record** | This assignment is no longer active |

#### Tracking Your Submissions

Within each requirement row, you can expand the submissions section to see:
- Every file you submitted
- The date you submitted it
- Which deadline it was for
- The current approval status
- Any remarks left by the admin

This history is always available, even after deadlines advance.

---

### 4.9 Frequently Asked Questions (PIC)

**Q: I did not receive an email when I was assigned. What should I do?**
Check your spam/junk folder first. If it is not there, log in to the system and check your **My Compliance Requirements** page — assignments are visible there even without the email. Contact your Compliance & Admin Specialist to resend or verify your email address.

---

**Q: Can I upload multiple files in one submission?**
Yes. You can attach multiple files (PDF, CSV, XLS, XLSX) in a single submission. There is no limit on the number of files, but each file must be under 250 MB.

---

**Q: My submission was rejected. Will the deadline change?**
No. The original deadline remains the same. You must resubmit before the existing deadline. If you need more time, contact your Compliance & Admin Specialist to request a deadline extension.

---

**Q: I was approved, but I can still see the old submission. Is that correct?**
Yes. The system preserves all past submissions as a permanent record. After approval, your status shows **Complied** and you cannot upload again for that same deadline cycle. The old submission stays visible in your history.

---

**Q: I am in sequential mode and the person before me has been approved, but I still cannot upload. What should I do?**
First, refresh the page. It may take a moment for the system to update. If the issue persists, check whether you received an activation email. If neither resolves it, contact your Compliance & Admin Specialist to verify your assignment status.

---

**Q: The deadline on my assignment is different from another PIC's deadline for the same requirement. Is that correct?**
Yes. In parallel mode, the admin can set individual deadlines per PIC. Your deadline is specific to you and may differ from others assigned to the same requirement.

---

**Q: When will my deadline for next month appear?**
For monthly requirements, the new deadline appears automatically after all PICs are approved and the auto-advance runs (approximately 2 days after the final approval). You will receive an email when this happens.

---

**Q: I can see a requirement in my History tab. Can I still view my old submissions?**
Yes. Historical assignments are read-only. You can see all past submissions and their statuses, but you cannot upload new documents to a historical assignment.

---

## 5. Glossary

| Term | Definition |
|---|---|
| **Assignment** | A record linking a specific PIC to a specific requirement, tracking their individual compliance status |
| **Auto-Advance** | The automatic process that advances a monthly requirement's deadline to the next month after all PICs are approved |
| **Compliance Status** | The overall status of a requirement based on all PICs' individual statuses |
| **Deadline** | The date by which a PIC must have an approved submission |
| **Frequency** | How often a requirement recurs (e.g., Monthly, Quarterly, Annual) |
| **Parallel Mode** | Assignment mode where all PICs can submit simultaneously |
| **PIC** | Person-In-Charge; the staff member responsible for submitting documents for a requirement |
| **Requirement** | A specific compliance obligation tracked in the system |
| **Sequence Order** | The numbered position of a PIC in a sequential assignment (1st, 2nd, 3rd, etc.) |
| **Sequential Mode** | Assignment mode where PICs must submit in a defined order, one after another |
| **Submission** | A set of files uploaded by a PIC for a requirement at a specific deadline |
| **Auto-Assign** | The process by which an admin assigns a PIC directly to a requirement, creating the assignment record and notifying the PIC automatically |
