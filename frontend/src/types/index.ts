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
  compliance_status?: string;
  created_at: string;
  updated_at: string;
  assignments?: RequirementAssignment[];
  uploads?: Upload[];
}

export interface RequirementAssignment {
  id: number;
  assignment_id: string;
  requirement_id: number;
  requirement?: Requirement;
  assigned_to_user_id: number;
  user?: User;
  deadline?: string;
  compliance_status: ComplianceStatus;
  last_submitted_at?: string;
  last_approved_at?: string;
  created_at: string;
  updated_at: string;
  uploads?: Upload[];
}

export type ComplianceStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'OVERDUE';

export interface Upload {
  id: number;
  upload_id: string;
  requirement_id: number;
  requirement?: Requirement;
  assignment_id?: number;
  assignment?: RequirementAssignment;
  doc_file: string;
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
