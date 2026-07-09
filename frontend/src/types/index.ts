export interface Role {
  id?: number;
  name: string;
}

export interface User {
  id: number;
  user_id: string;
  email: string;
  employee_name: string;
  branch: string;
  user_type?: string;
  is_active?: boolean;
  roles: Role[];
}

export interface Agency {
  id: number;
  agency_id: string;
  name: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchUnitDepartment {
  id: number;
  name: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: number;
  name: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Requirement {
  id: number;
  req_id: string;
  agency_id: number;
  agency?: Agency;
  category: string;
  requirement: string;
  description: string;
  position_ids?: string;
  branch_unit_department_ids?: string;
  person_in_charge_user_ids?: string;
  frequency: string;
  schedule: string;
  deadline?: string;
  auto_deadline_enabled?: boolean;
  assignment_mode?: 'parallel' | 'sequential';
  is_active?: boolean;
  deactivated_at?: string | null;
  deactivated_by_user_id?: number | null;
  compliance_status?: string;
  created_at: string;
  updated_at: string;
  assignments?: RequirementAssignment[];
  submissions?: UploadSubmission[];
}

export interface RequirementAssignment {
  id: number;
  assignment_id: string;
  requirement_id: number;
  requirement?: Requirement;
  assigned_to_user_id: number;
  sequence_order?: number | null;
  user?: User;
  deadline?: string;
  compliance_status: ComplianceStatus;
  is_active?: boolean;
  removed_at?: string | null;
  removed_by_user_id?: number | null;
  last_submitted_at?: string;
  last_approved_at?: string;
  created_at: string;
  updated_at: string;
  uploads?: Upload[];
  submissions?: UploadSubmission[];
}

export type ComplianceStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'OVERDUE';

export interface Upload {
  id: number;
  upload_id: string;
  submission_id?: number | null;
  requirement_id: number;
  requirement?: Requirement;
  assignment_id?: number;
  assignment?: RequirementAssignment;
  doc_file: string;
  original_file_name?: string | null;
  uploaded_by_user_id: number;
  uploader?: User;
  uploader_email: string;
  upload_date: string;
  deadline_at_upload?: string | null;
  comments: string | null;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  status_change_on: string | null;
  admin_remarks: string | null;
  upload_year: number;
  created_at: string;
  updated_at: string;
}

export interface UploadSubmission {
  id: number;
  submission_id: string;
  requirement_id: number;
  requirement?: Requirement;
  assignment_id?: number | null;
  assignment?: RequirementAssignment;
  uploaded_by_user_id: number;
  uploader?: User;
  uploader_email: string;
  upload_date: string;
  deadline_at_upload?: string | null;
  comments: string | null;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  status_change_on: string | null;
  admin_remarks: string | null;
  upload_year: number;
  created_at: string;
  updated_at: string;
  files?: Upload[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AuditLog {
  id: number;
  actor_user_id: number;
  actor?: User;
  action: string;
  entity_type: string;
  entity_id: number;
  before_json: any;
  after_json: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface UserDetails {
  user: User;
  requirements: Requirement[];
}

export type ComplianceReportStatus =
  | 'complied_on_time'
  | 'complied_late'
  | 'pending_approval'
  | 'pending_submission'
  | 'overdue'
  | 'rejected';

export interface ComplianceReportFilters {
  start_date: string;
  end_date: string;
  agency_id?: number;
  branch_unit_department_id?: number;
  user_id?: number;
  branch?: string;
  frequency?: string;
  status?: ComplianceReportStatus;
}

export interface ComplianceReportRow {
  assignment_id: number;
  assignment_code: string;
  requirement_id: number;
  requirement_code: string;
  requirement: string;
  agency_id?: number | null;
  agency_code?: string | null;
  agency_name?: string | null;
  user_id?: number | null;
  user_code?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_branch?: string | null;
  frequency?: string | null;
  assignment_mode: 'parallel' | 'sequential';
  sequence_order?: number | null;
  deadline: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  status: ComplianceReportStatus;
  status_label: string;
  days_late: number;
  latest_submission_id?: number | null;
  latest_submission_code?: string | null;
  latest_submission_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

export interface ComplianceReportSummary {
  total_due: number;
  requirements: number;
  users: number;
  complied_on_time: number;
  complied_late: number;
  pending_approval: number;
  pending_submission: number;
  overdue: number;
  rejected: number;
  completed: number;
  open: number;
  late_or_overdue: number;
  completion_rate: number;
  on_time_rate: number;
  open_rate: number;
  avg_days_late: number;
  max_days_late: number;
}

export interface ComplianceReportStatusBreakdown {
  status: ComplianceReportStatus;
  label: string;
  count: number;
}

export interface ComplianceReportUserBreakdown {
  user_id?: number | null;
  user_code?: string | null;
  user_name?: string | null;
  user_branch?: string | null;
  total: number;
  complied_on_time: number;
  complied_late: number;
  pending_approval: number;
  pending_submission: number;
  overdue: number;
  rejected: number;
}

export interface ComplianceReportAgencyBreakdown {
  agency_id?: number | null;
  agency_code?: string | null;
  agency_name?: string | null;
  total: number;
  complied_on_time: number;
  complied_late: number;
  pending_approval: number;
  pending_submission: number;
  overdue: number;
  rejected: number;
}

export interface ComplianceReportResponse {
  start_date: string;
  end_date: string;
  summary: ComplianceReportSummary;
  status_breakdown: ComplianceReportStatusBreakdown[];
  user_breakdown: ComplianceReportUserBreakdown[];
  agency_breakdown: ComplianceReportAgencyBreakdown[];
  rows: ComplianceReportRow[];
}
