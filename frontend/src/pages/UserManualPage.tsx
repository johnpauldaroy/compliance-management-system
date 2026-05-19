import { Tabs, Typography, Card, Collapse, Tag, Table } from 'antd';
import {
    UserOutlined,
    SafetyCertificateOutlined,
    CheckCircleOutlined,
    BellOutlined,
    CalendarOutlined,
    SwapOutlined,
    FileTextOutlined,
    QuestionCircleOutlined,
} from '@ant-design/icons';
import './UserManualPage.css';

const { Title, Paragraph, Text } = Typography;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="um-section">
        <Title level={4} className="um-section-title">{title}</Title>
        {children}
    </div>
);

const SuperAdminTab = () => (
    <div className="um-tab-content">
        <Paragraph className="um-lead">
            Super Admins have unrestricted access to the entire system. Every feature available to lower roles is also
            available to Super Admins.
        </Paragraph>

        <Section title="What Super Admins Can Do">
            <ul className="um-list">
                <li>Create, edit, and deactivate user accounts</li>
                <li>Assign roles to users (Super Admin, Compliance &amp; Admin Specialist, PIC)</li>
                <li>Perform all Compliance &amp; Admin Specialist actions (see that tab)</li>
                <li>View the full system audit trail</li>
                <li>Access all data across all agencies and departments</li>
            </ul>
        </Section>

        <Section title="Navigating the System">
            <Table
                size="small"
                pagination={false}
                dataSource={[
                    { page: 'Dashboard', purpose: 'Compliance overview, statistics, and calendar' },
                    { page: 'Reference Data', purpose: 'Manage agencies and categories' },
                    { page: 'Requirements', purpose: 'Create and manage compliance requirements' },
                    { page: 'Approvals', purpose: 'Review PIC document submissions' },
                    { page: 'Users', purpose: 'Manage user accounts and roles' },
                    { page: 'Audit Trail', purpose: 'Full history of all system actions' },
                    { page: 'My Requirements', purpose: 'View your own PIC assignments (if any)' },
                ]}
                columns={[
                    { title: 'Page', dataIndex: 'page', key: 'page', width: 180 },
                    { title: 'Purpose', dataIndex: 'purpose', key: 'purpose' },
                ]}
                rowKey="page"
            />
        </Section>

        <Section title="Recommendation">
            <Paragraph>
                Use the Super Admin role only for system configuration and user management. For day-to-day compliance
                work, use the Compliance &amp; Admin Specialist role to reduce the risk of unintended changes.
            </Paragraph>
        </Section>
    </div>
);

const AdminTab = () => (
    <div className="um-tab-content">
        <Paragraph className="um-lead">
            Compliance &amp; Admin Specialists are responsible for setting up requirements, assigning PICs, reviewing
            submissions, and monitoring overall compliance health.
        </Paragraph>

        <Collapse
            className="um-collapse"
            defaultActiveKey={['requirements']}
            items={[
                {
                    key: 'requirements',
                    label: 'Managing Requirements',
                    children: (
                        <>
                            <Title level={5}>Creating a Requirement</Title>
                            <ol className="um-list">
                                <li>Go to <Text strong>Requirements</Text> in the navigation sidebar.</li>
                                <li>Click <Text strong>Add Requirement</Text>.</li>
                                <li>Fill in: Agency, Category, Requirement Name, Description, Frequency, Schedule, and Deadline.</li>
                                <li>Choose the <Text strong>Assignment Mode</Text> — Parallel or Sequential.</li>
                                <li>Assign one or more PICs from the user list.</li>
                                <li>Click <Text strong>Save</Text>.</li>
                            </ol>
                            <Paragraph>
                                <Text type="warning">Note:</Text> Requirements with a <Text strong>Monthly</Text> frequency
                                have auto-advance automatically enabled — deadlines roll forward to the next month after
                                all PICs are approved.
                            </Paragraph>

                            <Title level={5} style={{ marginTop: 16 }}>Editing a Requirement</Title>
                            <Paragraph>
                                Click the edit icon on any requirement row. Changing the main deadline resets all PIC
                                assignment statuses back to <Tag>PENDING</Tag>.
                            </Paragraph>

                            <Title level={5} style={{ marginTop: 16 }}>Deactivating a Requirement</Title>
                            <Paragraph>
                                Open the requirement and click <Text strong>Deactivate</Text>. Deactivated requirements
                                are hidden from active views but their history is preserved.
                            </Paragraph>
                        </>
                    ),
                },
                {
                    key: 'assigning',
                    label: 'Assigning PICs',
                    children: (
                        <>
                            <Paragraph>
                                Add PICs when creating or editing a requirement. Two modes are available:
                            </Paragraph>
                            <Table
                                size="small"
                                pagination={false}
                                dataSource={[
                                    {
                                        mode: 'Parallel',
                                        how: 'All PICs work simultaneously. Each PIC has the same deadline (or individual deadlines you set).',
                                        compliant: 'When ALL PICs have an approved submission.',
                                    },
                                    {
                                        mode: 'Sequential',
                                        how: 'PICs are ordered. Only the first PIC can submit initially; each next PIC is activated after the previous is approved.',
                                        compliant: 'When the last PIC in the chain is approved.',
                                    },
                                ]}
                                columns={[
                                    { title: 'Mode', dataIndex: 'mode', key: 'mode', width: 120 },
                                    { title: 'How It Works', dataIndex: 'how', key: 'how' },
                                    { title: 'Fully Complied When', dataIndex: 'compliant', key: 'compliant' },
                                ]}
                                rowKey="mode"
                            />
                            <Paragraph style={{ marginTop: 12 }}>
                                <Text type="warning">Note:</Text> You cannot remove a PIC who has a submission currently
                                pending review. Resolve the submission first.
                            </Paragraph>
                        </>
                    ),
                },
                {
                    key: 'reviewing',
                    label: 'Reviewing Submissions',
                    children: (
                        <ol className="um-list">
                            <li>Go to <Text strong>Approvals</Text> in the navigation sidebar.</li>
                            <li>The list defaults to <Tag color="blue">PENDING</Tag> submissions.</li>
                            <li>Click a submission row to view its files.</li>
                            <li>Choose <Text strong>Approve</Text> or <Text strong>Reject</Text>.</li>
                            <li>Remarks are optional for approval; <Text type="danger">required</Text> for rejection.</li>
                            <li>The PIC receives an email notification with the outcome automatically.</li>
                        </ol>
                    ),
                },
                {
                    key: 'monitoring',
                    label: 'Monitoring Compliance',
                    children: (
                        <>
                            <Paragraph>The <Text strong>Dashboard</Text> provides:</Paragraph>
                            <ul className="um-list">
                                <li>Overall compliance rate across all requirements</li>
                                <li>Breakdown by agency</li>
                                <li>Calendar view of upcoming and past deadlines</li>
                                <li>Recent activity log</li>
                            </ul>
                            <Paragraph style={{ marginTop: 12 }}>
                                Use the <Text strong>Requirements</Text> page filters to view requirements by status:
                            </Paragraph>
                            <Table
                                size="small"
                                pagination={false}
                                dataSource={[
                                    { status: 'N/A', meaning: 'No deadline has been set' },
                                    { status: 'Pending', meaning: 'In progress — not yet fully complied' },
                                    { status: 'Complied', meaning: 'All assigned PICs have been approved' },
                                    { status: 'Overdue', meaning: 'At least one PIC missed the deadline' },
                                ]}
                                columns={[
                                    { title: 'Status', dataIndex: 'status', key: 'status', width: 120 },
                                    { title: 'Meaning', dataIndex: 'meaning', key: 'meaning' },
                                ]}
                                rowKey="status"
                            />
                        </>
                    ),
                },
                {
                    key: 'upload-behalf',
                    label: 'Uploading on Behalf of a PIC',
                    children: (
                        <ol className="um-list">
                            <li>Open the requirement.</li>
                            <li>Find the PIC's assignment row.</li>
                            <li>Click <Text strong>Upload</Text> on their row.</li>
                            <li>Select files and submit.</li>
                        </ol>
                    ),
                },
                {
                    key: 'import',
                    label: 'Bulk Import',
                    children: (
                        <Paragraph>
                            Use the <Text strong>Import</Text> button on the Requirements page to upload a CSV file
                            containing multiple requirements at once. Download the template file first to ensure the
                            correct column format.
                        </Paragraph>
                    ),
                },
            ]}
        />
    </div>
);

const PicTab = () => (
    <div className="um-tab-content">
        <Paragraph className="um-lead">
            As a Person-In-Charge (PIC), your responsibility is to upload the required compliance documents for the
            requirements you are assigned to, by the specified deadlines.
        </Paragraph>

        <Collapse
            className="um-collapse"
            defaultActiveKey={['getting-started']}
            items={[
                {
                    key: 'getting-started',
                    label: (
                        <span>
                            <UserOutlined style={{ marginRight: 8 }} />
                            Getting Started
                        </span>
                    ),
                    children: (
                        <>
                            <Paragraph>
                                When you are first assigned to a requirement, you will receive an <Text strong>email
                                notification</Text> containing the requirement name, your deadline, and a link to the
                                system.
                            </Paragraph>
                            <Paragraph>
                                Log in and navigate to <Text strong>My Requirements</Text> in the sidebar — this is your
                                main workspace. It has two tabs:
                            </Paragraph>
                            <Table
                                size="small"
                                pagination={false}
                                dataSource={[
                                    { tab: 'Active', shows: 'Requirements you are currently assigned to' },
                                    { tab: 'History', shows: 'Requirements you were previously assigned to but are no longer active on' },
                                ]}
                                columns={[
                                    { title: 'Tab', dataIndex: 'tab', key: 'tab', width: 100 },
                                    { title: 'Shows', dataIndex: 'shows', key: 'shows' },
                                ]}
                                rowKey="tab"
                            />
                            <Paragraph style={{ marginTop: 12 }}>
                                Each requirement row shows: the name and agency, category, your deadline, your current
                                status, and your full submission history grouped by deadline.
                            </Paragraph>
                        </>
                    ),
                },
                {
                    key: 'auto-assign',
                    label: (
                        <span>
                            <CheckCircleOutlined style={{ marginRight: 8 }} />
                            How Auto-Assign Works
                        </span>
                    ),
                    children: (
                        <>
                            <Paragraph>
                                You do not need to request or sign up for requirements. The Compliance &amp; Admin
                                Specialist <Text strong>assigns you directly</Text> when creating or editing a
                                requirement. The assignment is created instantly and automatically.
                            </Paragraph>
                            <Title level={5}>What happens when you are assigned:</Title>
                            <ol className="um-list">
                                <li>The system creates a compliance assignment record for you.</li>
                                <li>You receive an email notification with your deadline.</li>
                                <li>The requirement appears on your <Text strong>Active</Text> tab.</li>
                                <li>
                                    If the assignment is in <Text strong>Sequential Mode</Text> and you are not first in
                                    line, you will see your assignment but will not be able to upload yet — a separate
                                    email will notify you when your turn becomes active.
                                </li>
                            </ol>
                            <Title level={5} style={{ marginTop: 12 }}>What happens when you are removed:</Title>
                            <ul className="um-list">
                                <li>The assignment moves to your <Text strong>History</Text> tab.</li>
                                <li>You can no longer upload to it.</li>
                                <li>
                                    <Text type="warning">Note:</Text> You cannot be removed while you have a submission
                                    currently pending review — the admin must resolve it first.
                                </li>
                            </ul>
                        </>
                    ),
                },
                {
                    key: 'modes',
                    label: (
                        <span>
                            <SwapOutlined style={{ marginRight: 8 }} />
                            Parallel Mode vs Sequential Mode
                        </span>
                    ),
                    children: (
                        <>
                            <Paragraph>
                                Your admin chooses one of two modes when setting up a requirement. Understanding which
                                mode applies to you determines when and how you can submit.
                            </Paragraph>

                            <div className="um-mode-cards">
                                <Card
                                    className="um-mode-card"
                                    title={<><Tag color="blue">Parallel Mode</Tag></>}
                                    size="small"
                                >
                                    <Paragraph>
                                        All PICs assigned to the requirement can submit <Text strong>at the same
                                        time</Text>, independently of each other.
                                    </Paragraph>
                                    <ul className="um-list">
                                        <li>Your assignment is active immediately.</li>
                                        <li>You can upload as soon as you are assigned.</li>
                                        <li>Your deadline may match other PICs, or your admin may give you an individual deadline.</li>
                                        <li>Your submission is reviewed independently.</li>
                                        <li>Other PICs being approved or delayed does not affect your ability to submit.</li>
                                    </ul>
                                    <div className="um-example">
                                        <Text type="secondary" strong>Example:</Text>
                                        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                                            PICs A, B, and C are assigned in parallel. All three can upload on the same
                                            day. Each is reviewed separately. The requirement is fully complied only
                                            when all three are approved.
                                        </Paragraph>
                                    </div>
                                </Card>

                                <Card
                                    className="um-mode-card"
                                    title={<><Tag color="purple">Sequential Mode</Tag></>}
                                    size="small"
                                >
                                    <Paragraph>
                                        PICs are ordered in a chain. <Text strong>Only one PIC is active at a
                                        time.</Text> Each PIC must be approved before the next one can submit.
                                    </Paragraph>
                                    <ul className="um-list">
                                        <li>Your assignment has a sequence order (1st, 2nd, 3rd, etc.).</li>
                                        <li>If you are <Text strong>1st in sequence</Text>, you can upload immediately.</li>
                                        <li>If you are <Text strong>2nd or later</Text>, your assignment is on hold until the person before you is approved.</li>
                                        <li>When the previous PIC is approved, you receive an email telling you it is now your turn.</li>
                                        <li>A badge labeled <Tag color="green">ACTIVE</Tag> appears next to your assignment when it is your turn.</li>
                                        <li>Hovering over a disabled Upload button shows a tooltip explaining you are waiting.</li>
                                    </ul>
                                    <div className="um-example">
                                        <Text type="secondary" strong>Example (A → B → C):</Text>
                                        <ol className="um-list" style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 0 }}>
                                            <li>PIC A is active. B and C see their assignments but cannot upload.</li>
                                            <li>A submits → Admin approves → B is activated → B receives email.</li>
                                            <li>B submits → Admin approves → C is activated → C receives email.</li>
                                            <li>C submits → Admin approves → Requirement is fully complied.</li>
                                        </ol>
                                    </div>
                                </Card>
                            </div>
                        </>
                    ),
                },
                {
                    key: 'submitting',
                    label: (
                        <span>
                            <FileTextOutlined style={{ marginRight: 8 }} />
                            Submitting Documents
                        </span>
                    ),
                    children: (
                        <>
                            <Title level={5}>Before You Submit — Checklist</Title>
                            <ul className="um-checklist">
                                <li>Your assignment is active (not waiting in sequential mode).</li>
                                <li>A deadline has been set (if it shows N/A, contact your admin).</li>
                                <li>You do not already have a submission waiting for approval for this deadline.</li>
                                <li>Your status is not already <Tag color="green">Complied</Tag> for this deadline.</li>
                            </ul>

                            <Title level={5} style={{ marginTop: 16 }}>How to Upload</Title>
                            <ol className="um-list">
                                <li>Go to <Text strong>My Requirements</Text>.</li>
                                <li>Find the requirement you need to submit for.</li>
                                <li>Click the <Text strong>Upload</Text> button on that row.</li>
                                <li>
                                    In the upload dialog:
                                    <ul className="um-list" style={{ marginTop: 4 }}>
                                        <li><Text strong>Select Files</Text> — Browse or drag and drop.</li>
                                        <li><Text strong>Accepted formats:</Text> PDF, CSV, XLS, XLSX.</li>
                                        <li><Text strong>Maximum file size:</Text> 250 MB per file.</li>
                                        <li>Multiple files can be uploaded in a single submission.</li>
                                        <li><Text strong>Comments</Text> — Optionally add a note for the reviewer.</li>
                                    </ul>
                                </li>
                                <li>Click <Text strong>Submit</Text>.</li>
                            </ol>
                            <Paragraph>
                                After submitting, your status changes to <Tag color="blue">For Approval</Tag> and the
                                admin receives a notification automatically.
                            </Paragraph>

                            <Title level={5} style={{ marginTop: 16 }}>If Your Submission is Rejected</Title>
                            <ol className="um-list">
                                <li>You will receive an email with the admin's remarks.</li>
                                <li>Your status resets to <Tag>Pending</Tag>.</li>
                                <li>Review the remarks visible on your submission row.</li>
                                <li>Upload corrected documents using the <Text strong>Upload</Text> button again.</li>
                            </ol>
                            <Paragraph>
                                <Text type="danger">Important:</Text> The original deadline does not change when you are
                                rejected. Resubmit before the existing deadline.
                            </Paragraph>

                            <Title level={5} style={{ marginTop: 16 }}>Why the Upload Button May Be Disabled</Title>
                            <Table
                                size="small"
                                pagination={false}
                                dataSource={[
                                    { reason: 'No deadline set', action: 'Contact your Compliance & Admin Specialist to set a deadline.' },
                                    { reason: 'Already Complied', action: 'You are approved for this cycle. Wait for the next cycle.' },
                                    { reason: 'For Approval', action: 'Your submission is being reviewed. Wait for the admin\'s decision.' },
                                    { reason: 'Waiting in sequence', action: 'Another PIC must be approved before your turn. Wait for your activation email.' },
                                    { reason: 'Historical record', action: 'This assignment is no longer active.' },
                                ]}
                                columns={[
                                    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 200 },
                                    { title: 'What to Do', dataIndex: 'action', key: 'action' },
                                ]}
                                rowKey="reason"
                            />
                        </>
                    ),
                },
                {
                    key: 'notifications',
                    label: (
                        <span>
                            <BellOutlined style={{ marginRight: 8 }} />
                            Notifications You Will Receive
                        </span>
                    ),
                    children: (
                        <>
                            <Paragraph>
                                The system sends email notifications automatically. You do not need to check the system
                                constantly — emails will prompt you when action is needed.
                            </Paragraph>

                            <div className="um-notification-list">
                                <Card size="small" className="um-notification-card" title="1. New Assignment / Deadline Set">
                                    <Paragraph><Text strong>When:</Text> You are assigned to a requirement, or your deadline is updated by an admin.</Paragraph>
                                    <Paragraph><Text strong>Email tells you:</Text> The requirement name, your deadline, and assignment details.</Paragraph>
                                    <Paragraph style={{ marginBottom: 0 }}><Text strong>What to do:</Text> Log in and submit your documents before the deadline.</Paragraph>
                                </Card>

                                <Card size="small" className="um-notification-card" title={<>2. Your Turn is Active <Tag color="purple">Sequential Mode Only</Tag></>}>
                                    <Paragraph><Text strong>When:</Text> The PIC before you in the sequence has been approved by an admin.</Paragraph>
                                    <Paragraph><Text strong>Email tells you:</Text> The requirement name, that your turn is now active, and your deadline.</Paragraph>
                                    <Paragraph style={{ marginBottom: 0 }}><Text strong>What to do:</Text> Log in immediately and upload your documents. The deadline is counting down.</Paragraph>
                                </Card>

                                <Card size="small" className="um-notification-card" title={<>3. Submission Approved <Tag color="green">Action: None Required</Tag></>}>
                                    <Paragraph><Text strong>When:</Text> An admin approves your submission.</Paragraph>
                                    <Paragraph><Text strong>Email tells you:</Text> The requirement name, approval confirmation, and any remarks from the admin.</Paragraph>
                                    <Paragraph style={{ marginBottom: 0 }}><Text strong>What to do:</Text> No immediate action needed. For monthly requirements, watch for the next cycle notification.</Paragraph>
                                </Card>

                                <Card size="small" className="um-notification-card" title={<>4. Submission Rejected <Tag color="red">Action Required</Tag></>}>
                                    <Paragraph><Text strong>When:</Text> An admin rejects your submission.</Paragraph>
                                    <Paragraph><Text strong>Email tells you:</Text> The requirement name and the admin's remarks explaining what needs to be corrected.</Paragraph>
                                    <Paragraph style={{ marginBottom: 0 }}><Text strong>What to do:</Text> Log in, review the remarks, and resubmit corrected documents. Your deadline is still counting.</Paragraph>
                                </Card>

                                <Card size="small" className="um-notification-card" title={<>5. Monthly Deadline Advanced <Tag color="orange">Monthly Requirements Only</Tag></>}>
                                    <Paragraph><Text strong>When:</Text> After all PICs are approved, the system automatically advances to the next month's cycle.</Paragraph>
                                    <Paragraph><Text strong>Email tells you:</Text> The requirement name and your new deadline for the upcoming month.</Paragraph>
                                    <Paragraph style={{ marginBottom: 0 }}><Text strong>What to do:</Text> Note the new deadline and prepare for the next cycle. No immediate action unless the deadline is approaching.</Paragraph>
                                </Card>
                            </div>
                        </>
                    ),
                },
                {
                    key: 'auto-advance',
                    label: (
                        <span>
                            <CalendarOutlined style={{ marginRight: 8 }} />
                            Monthly Auto-Advance
                        </span>
                    ),
                    children: (
                        <>
                            <Paragraph>
                                For requirements with a <Text strong>Monthly</Text> frequency, the system automatically
                                resets and advances to the next compliance cycle after all PICs are approved. You do not
                                need to ask your admin to reset anything.
                            </Paragraph>

                            <Title level={5}>How It Works — Step by Step</Title>
                            <ol className="um-list">
                                <li>You and all PICs are <Text strong>approved</Text> for the current month's deadline.</li>
                                <li>The system <Text strong>waits approximately 2 days</Text> after the final approval (to allow admins time to review and make corrections).</li>
                                <li>The system checks whether the deadline has passed.</li>
                                <li>If the deadline has passed, it advances to the <Text strong>same day of the next month</Text> (e.g., January 31 → February 28).</li>
                                <li>All PIC assignments <Text strong>reset to Pending</Text>.</li>
                                <li>Email notifications are sent to the active PIC(s) with the new deadline.</li>
                            </ol>

                            <Title level={5} style={{ marginTop: 16 }}>What Changes After Auto-Advance</Title>
                            <Table
                                size="small"
                                pagination={false}
                                dataSource={[
                                    { before: 'Status: Complied', after: 'Status: Pending' },
                                    { before: 'Deadline: Jan 31, 2026', after: 'Deadline: Feb 28, 2026' },
                                    { before: 'Old submissions preserved', after: 'Old submissions still preserved (visible in history)' },
                                    { before: 'Cannot re-upload', after: 'Upload button becomes active again' },
                                ]}
                                columns={[
                                    { title: 'Before Advance', dataIndex: 'before', key: 'before' },
                                    { title: 'After Advance', dataIndex: 'after', key: 'after' },
                                ]}
                                rowKey="before"
                            />

                            <Title level={5} style={{ marginTop: 16 }}>In Sequential Mode</Title>
                            <Paragraph>
                                When the requirement uses sequential mode, the auto-advance:
                            </Paragraph>
                            <ul className="um-list">
                                <li>Resets <Text strong>all</Text> PICs in the sequence back to Pending.</li>
                                <li>Reactivates the <Text strong>first PIC in the sequence</Text> for the new cycle.</li>
                                <li>Sends the deadline notification only to the first PIC.</li>
                                <li>The second, third, etc. PICs will be activated again in order as usual.</li>
                            </ul>

                            <Title level={5} style={{ marginTop: 16 }}>Your Submission History Is Always Preserved</Title>
                            <Paragraph>
                                Auto-advance does <Text strong>not</Text> delete old submissions. All past submissions
                                remain visible in the requirement row, grouped by the deadline they were submitted for.
                                You can scroll through your history to see any previous cycle.
                            </Paragraph>

                            <Title level={5} style={{ marginTop: 16 }}>Example — Parallel Mode</Title>
                            <div className="um-timeline">
                                <div className="um-timeline-item"><Tag color="default">Jan 25</Tag> Alice submits → status: For Approval</div>
                                <div className="um-timeline-item"><Tag color="default">Jan 26</Tag> Bob submits → status: For Approval</div>
                                <div className="um-timeline-item"><Tag color="default">Jan 27</Tag> Admin approves Alice</div>
                                <div className="um-timeline-item"><Tag color="default">Jan 28</Tag> Admin approves Bob — 2-day window begins</div>
                                <div className="um-timeline-item"><Tag color="blue">Jan 30</Tag> Deadline passed → system advances to Feb 28</div>
                                <div className="um-timeline-item"><Tag color="green">Jan 30</Tag> Alice and Bob both receive email: "New deadline: Feb 28, 2026"</div>
                                <div className="um-timeline-item"><Tag color="default">Feb 15</Tag> Alice and Bob can now upload for the February cycle</div>
                            </div>

                            <Title level={5} style={{ marginTop: 16 }}>Example — Sequential Mode (A → B → C)</Title>
                            <div className="um-timeline">
                                <div className="um-timeline-item"><Tag color="default">Jan 20</Tag> Alice submits → Admin approves → Bob activated</div>
                                <div className="um-timeline-item"><Tag color="default">Jan 22</Tag> Bob submits → Admin approves → Carol activated</div>
                                <div className="um-timeline-item"><Tag color="default">Jan 24</Tag> Carol submits → Admin approves — 2-day window begins (Carol is last)</div>
                                <div className="um-timeline-item"><Tag color="blue">Jan 26</Tag> Deadline passed → system advances to Feb 28</div>
                                <div className="um-timeline-item"><Tag color="green">Jan 26</Tag> All statuses reset to Pending; Alice reactivated as 1st</div>
                                <div className="um-timeline-item"><Tag color="green">Jan 26</Tag> Alice receives email: "New deadline: Feb 28, 2026"</div>
                                <div className="um-timeline-item"><Tag color="default">Feb onward</Tag> Bob and Carol wait for Alice to complete first, as usual</div>
                            </div>
                        </>
                    ),
                },
                {
                    key: 'faq',
                    label: (
                        <span>
                            <QuestionCircleOutlined style={{ marginRight: 8 }} />
                            Frequently Asked Questions
                        </span>
                    ),
                    children: (
                        <div className="um-faq">
                            {[
                                {
                                    q: 'I did not receive an email when I was assigned. What should I do?',
                                    a: 'Check your spam/junk folder first. If not there, log in and check My Requirements — assignments are visible even without the email. Contact your Compliance & Admin Specialist to verify your email address or resend the notification.',
                                },
                                {
                                    q: 'Can I upload multiple files in one submission?',
                                    a: 'Yes. You can attach multiple files (PDF, CSV, XLS, XLSX) in a single submission. There is no limit on the number of files, but each file must be under 250 MB.',
                                },
                                {
                                    q: 'My submission was rejected. Will the deadline change?',
                                    a: 'No. The original deadline remains the same. You must resubmit before the existing deadline. If you need more time, contact your Compliance & Admin Specialist to request a deadline extension.',
                                },
                                {
                                    q: 'I was approved, but I can still see the old submission. Is that correct?',
                                    a: 'Yes. The system preserves all past submissions as a permanent record. After approval, your status shows Complied and you cannot upload again for that same deadline cycle. The old submission stays visible in your history.',
                                },
                                {
                                    q: 'I am in sequential mode and the person before me has been approved, but I still cannot upload.',
                                    a: 'First, refresh the page — it may take a moment to update. If the issue persists, check whether you received an activation email. If neither resolves it, contact your Compliance & Admin Specialist to verify your assignment status.',
                                },
                                {
                                    q: 'My deadline is different from another PIC\'s deadline for the same requirement. Is that correct?',
                                    a: 'Yes. In parallel mode, admins can set individual deadlines per PIC. Your deadline is specific to you and may differ from others on the same requirement.',
                                },
                                {
                                    q: 'When will my deadline for next month appear?',
                                    a: 'For monthly requirements, the new deadline appears automatically after all PICs are approved and the auto-advance runs (approximately 2 days after the final approval). You will receive an email when this happens.',
                                },
                                {
                                    q: 'I can see a requirement in my History tab. Can I still view my old submissions?',
                                    a: 'Yes. Historical assignments are read-only. You can see all past submissions and their statuses, but you cannot upload new documents to a historical assignment.',
                                },
                            ].map(({ q, a }) => (
                                <div key={q} className="um-faq-item">
                                    <Text strong className="um-faq-q">Q: {q}</Text>
                                    <Paragraph className="um-faq-a">A: {a}</Paragraph>
                                </div>
                            ))}
                        </div>
                    ),
                },
            ]}
        />
    </div>
);

const UserManualPage = () => (
    <div className="user-manual-page">
        <Title level={2}>User Manual</Title>
        <Paragraph className="um-subtitle" type="secondary">
            Select your role below to view the relevant guide.
        </Paragraph>

        <Card className="um-card">
            <Tabs
                defaultActiveKey="pic"
                size="large"
                items={[
                    {
                        key: 'pic',
                        label: (
                            <span>
                                <CheckCircleOutlined />
                                Person-In-Charge (PIC)
                            </span>
                        ),
                        children: <PicTab />,
                    },
                    {
                        key: 'admin',
                        label: (
                            <span>
                                <SafetyCertificateOutlined />
                                Compliance &amp; Admin Specialist
                            </span>
                        ),
                        children: <AdminTab />,
                    },
                    {
                        key: 'super',
                        label: (
                            <span>
                                <UserOutlined />
                                Super Admin
                            </span>
                        ),
                        children: <SuperAdminTab />,
                    },
                ]}
            />
        </Card>
    </div>
);

export default UserManualPage;
