# HRMS Project Workflow Documentation

## 1. Project Overview

This HRMS project is a multi-tenant workforce management system built with a React frontend and an Express/MongoDB backend. It supports four major user roles:

- Master Admin: platform-level owner who manages subscribed companies/admins, plan settings, login access, issues, domains, and demo requests.
- Admin: tenant/company owner who manages employees, support admins, attendance, leave, payroll, subscriptions, documents, and operational settings.
- Support Admin: delegated administration user created by an Admin, with assigned permissions and its own attendance/profile workflow.
- Employee: company employee who uses attendance, leave, overtime, notices, work tracker, documents, payroll, and requests.

The backend follows a common route -> middleware -> controller/route handler -> model -> MongoDB workflow. The frontend follows React route protection -> layout -> page load -> API call -> state update -> UI render.

## 2. Overall Project Workflow

1. User opens the app.
   - Public pages load from React routes such as `/`, `/login`, `/request-demo`, `/master`, `/employee-onboarding`, and `/document-verification`.
   - Logged-in users are redirected away from public pages by `PublicRoute` in `FRONTEND/src/App.jsx`.

2. Login and authentication.
   - Normal users authenticate through `AuthProvider`.
   - The frontend first tries `/api/admin/login` for admin/support-admin accounts.
   - If admin login returns `401`, it falls back to `/api/auth/login` for employee login.
   - Master Admin logs in through `/api/master/login`.
   - Face and fingerprint flows use `/api/face-auth` and `/api/webauthn`.

3. Role detection.
   - Login response contains a JWT and `user.role`.
   - Roles are stored in `sessionStorage` through `hrmsUser`, `token`, `hrms-token`, or `masterToken`.
   - React routing checks the role and redirects to the correct dashboard.

4. Route protection.
   - Frontend protection happens in `ProtectedRoute.jsx`.
   - Backend protection happens through `protect` in `authController.js`, `authMiddleware.js`, or `middleware/protect.js`.
   - Master routes use `protectMaster`.
   - Admin-only routes use `onlyAdmin`.
   - Subscription expiry is checked after login and during protected API access through `subscriptionAccess.js`.

5. Dashboard loading.
   - Layout components mount after route protection.
   - Context providers fetch shared data such as employees, notices, attendance, leave, overtime, and notifications.
   - Dashboard pages call backend endpoints and render cards, charts, tables, and request counters.

6. API requests.
   - Frontend uses the configured Axios instance in `FRONTEND/src/api.js`.
   - Axios attaches the best available token from `sessionStorage`.
   - Backend validates JWT, resolves the current user, scopes requests by `adminId` and/or `companyId`, and returns JSON.

7. Database operations.
   - MongoDB stores data through Mongoose models.
   - Core tenant data is linked by `adminId`.
   - Employee-specific data is linked by `employeeId`, `company`, and `adminId`.
   - Company-level data uses `companyId`.

8. Response handling and UI updates.
   - Pages or context providers store response data in React state.
   - Forms show success/error messages through alerts, SweetAlert, toasts, or inline UI.
   - Some modules emit Socket.IO events to refresh request counters or notify dashboards.

## 3. Complete System Workflow

```mermaid
flowchart TD
  A["User opens React app"] --> B{"Public or protected route?"}
  B -->|Public| C["Render public page"]
  B -->|Protected| D["ProtectedRoute checks session user"]
  D -->|No user| E["Redirect to public/login"]
  D -->|User exists| F{"Role allowed?"}
  F -->|No| E
  F -->|Yes| G["Render role layout"]
  G --> H["Page/context sends API request through api.js"]
  H --> I["Axios attaches JWT"]
  I --> J["Express route receives request"]
  J --> K["Middleware verifies JWT and subscription access"]
  K -->|Invalid/expired| L["Return 401/403"]
  K -->|Valid| M["Controller or route handler runs"]
  M --> N["Mongoose model queries MongoDB"]
  N --> O["JSON response"]
  O --> P["React state/context updates"]
  P --> Q["UI re-renders"]
  M --> R["Optional Socket.IO event/email/notification"]
  R --> Q
```

## 4. Authentication Flow

```mermaid
flowchart TD
  A["Login form submit"] --> B["AuthProvider.login(email,password)"]
  B --> C["POST /api/admin/login"]
  C --> D{"Admin/support-admin found?"}
  D -->|Yes| E["Check password, loginEnabled, plan grace period"]
  E --> F{"Allowed?"}
  F -->|No| G["403 expired/loginStopped"]
  F -->|Yes| H["Return JWT and user"]
  D -->|401| I["POST /api/auth/login"]
  I --> J["Find Admin, SupportAdmin, or Employee"]
  J --> K["Check employee active/login access"]
  K --> L["Check root admin subscription grace period"]
  L --> M{"Allowed?"}
  M -->|No| G
  M -->|Yes| H
  H --> N["Save token and user in sessionStorage"]
  N --> O{"Role"}
  O -->|admin| P["/admin/dashboard"]
  O -->|support-admin| Q["/support-admin/dashboard"]
  O -->|employee| R["/employee/dashboard"]
  O -->|master| S["/master/dashboard"]
```

## 5. Role-Based Workflows

### 5.1 Admin Workflow

1. Admin logs in using `/api/admin/login`.
2. Backend validates password, login access, plan settings, and subscription grace period.
3. React routes Admin through `ProtectedRoute allow={["admin", "support-admin"]}`.
4. `LayoutAdmin` loads navigation and admin-facing pages.
5. Admin can:
   - Manage employees and support admins.
   - Configure shifts, office location, leave policies, payroll rules, holidays, groups, notices, documents, and domains.
   - Approve/reject leave, overtime, attendance corrections, punch-out requests, work-mode requests, and resignation flows.
   - View attendance dashboards, live tracking, issue management, billing, and subscription renewal.
6. All records are scoped by `adminId` and often `companyId`.

```mermaid
flowchart TD
  A["Admin login"] --> B["Admin dashboard"]
  B --> C["Employee management"]
  B --> D["Attendance and live tracking"]
  B --> E["Leave/overtime/punch-out approvals"]
  B --> F["Payroll and payslips"]
  B --> G["Support admin management"]
  B --> H["Subscription billing"]
  C --> I["Employee CRUD in MongoDB"]
  D --> J["Attendance records by adminId/companyId"]
  E --> K["Request status updates and notifications"]
  F --> L["PayrollRecord upsert"]
  G --> M["SupportAdmin records with assignedFeatures"]
  H --> N["Razorpay order and payment verification"]
```

### 5.2 Support Admin Workflow

1. Admin creates a support admin from `SupportAdminManagement.jsx`.
2. Backend stores the support admin in `supportAdminModel` with:
   - `adminId`
   - `supportAdminId`
   - `positionName`
   - `assignedFeatures`
   - `loginEnabled`
3. Support Admin logs in through the admin login attempt or `/api/auth/login`.
4. Backend resolves the root `adminId`.
5. Frontend sends support admin to `/support-admin/dashboard`.
6. Support Admin can access assigned admin pages and personal attendance/profile workflows.

### 5.3 Employee Workflow

1. Employee account is created by Admin or completed through onboarding.
2. Employee logs in through `/api/auth/login`.
3. Backend checks:
   - password
   - `loginEnabled`
   - `isActive` and `status`
   - root Admin subscription access
4. Employee dashboard loads with attendance, leave, notices, work tracker, payroll, and profile data.
5. Employee can:
   - Punch in/out.
   - Request leave, overtime, work mode, attendance correction, punch-out correction.
   - Track daily work.
   - Read notices and notifications.
   - View payslip and attendance history.
   - Submit documents/resignation/issues.

```mermaid
flowchart TD
  A["Employee login"] --> B["Employee dashboard"]
  B --> C["Attendance punch in/out"]
  B --> D["Leave request"]
  B --> E["Overtime request"]
  B --> F["Daily work tracker"]
  B --> G["Notices and notifications"]
  B --> H["Payslip/profile/documents"]
  C --> I["Attendance model"]
  D --> J["LeaveRequest model"]
  E --> K["Overtime model"]
  F --> L["DailyWorkEntry/WorkImage models"]
  G --> M["Notice/Notification models"]
```

### 5.4 Master Admin Workflow

1. Master Admin logs in through `/api/master/login`.
2. `masterToken` is saved in `sessionStorage`.
3. `ProtectedMasterRoute` allows `/master/*` routes.
4. Master Admin can:
   - View all admins/companies.
   - Manage platform plan settings.
   - Manage login access.
   - View total plan value and generated revenue.
   - Handle platform-level issues and demo requests.
   - Manage domains.

## 6. Module Workflows

### 6.1 Attendance Punch-In/Punch-Out

1. Employee or Support Admin opens attendance page/dashboard.
2. Frontend collects location and user identity.
3. API call reaches `/api/attendance`.
4. `protect` verifies token and subscription.
5. Attendance route loads employee, shift, leave, holiday, and existing attendance.
6. Punch-in creates or updates a daily attendance record.
7. Punch-out closes open session, calculates worked seconds, break seconds, status, and category.
8. Emails/notifications can be triggered for irregular attendance.
9. UI refreshes attendance and live counters.

```mermaid
flowchart TD
  A["Employee clicks Punch In/Out"] --> B["Frontend gets location"]
  B --> C["POST /api/attendance/..."]
  C --> D["protect middleware"]
  D --> E["Load Shift, Employee, Leave, Holiday"]
  E --> F{"Punch type"}
  F -->|Punch in| G["Create daily record or new session"]
  F -->|Punch out| H["Close session and calculate duration"]
  H --> I["Set workedStatus/loginStatus/category"]
  G --> J["Save Attendance document"]
  I --> J
  J --> K["Return updated attendance"]
  K --> L["UI updates timer/status"]
```

### 6.2 Punch-Out Request Approval

1. Employee submits a punch-out correction request through `/api/punchoutreq/create`.
2. Backend creates `PunchOutRequest` scoped by `adminId`, `companyId`, and `employeeId`.
3. Socket.IO emits `punchout:new`.
4. Admin fetches `/api/punchoutreq/all`.
5. Admin approves/rejects through `/api/punchoutreq/action`.
6. On approval, backend updates the nested daily attendance record, closes open session, recalculates worked time, and emits `punchout:updated`.

### 6.3 Leave Request Approval

1. Employee/support-admin submits leave via `/api/leaves/apply`.
2. Backend validates date range, policy, leave balance, paid/unpaid split, sandwich leave, and month key.
3. `LeaveRequest` is created as `Pending`.
4. Admin lists requests through `/api/leaves`.
5. Admin approves/rejects with `/api/leaves/:id/approve` or `/api/leaves/:id/reject`.
6. Approval updates status, action date, approver, and policy counters.
7. UI dashboards and leave summaries refresh.

### 6.4 Overtime Request Approval

1. Employee submits overtime through `/api/overtime/apply`.
2. `Overtime` document stores employee, admin, company, date/time, reason, and status.
3. Admin fetches `/api/overtime/all`.
4. Admin updates status with `/api/overtime/update-status/:id`.
5. Employee can view their requests through `/api/overtime/:employeeId` or cancel through `/api/overtime/cancel/:id`.

### 6.5 Payroll Generation

1. Admin opens payroll page.
2. Frontend loads employees, payroll rules, attendance, leave, and salary details.
3. Backend payroll routes are protected by `protect`.
4. Admin can maintain payroll rules through `/api/payroll/rules`.
5. Payroll generation calculates:
   - worked days
   - full/half/absent days
   - leaves consumed
   - LOP
   - late penalties
   - allowances/deductions
   - net payable salary
6. Saved payroll uses `/api/payroll/save-batch` and creates/upserts `PayrollRecord`.
7. Employee can retrieve payslip through `/api/payroll/record/:employeeId`.

### 6.6 Subscription Renewal

1. Admin opens profile billing modal.
2. Frontend calls `/api/razorpay/next-bill`.
3. Backend calculates:
   - main plan billing amount
   - base user limit
   - same billing day add-ons merged into main bill
   - separate add-on bills
4. Admin clicks Pay Now.
5. Razorpay checkout opens.
6. Payment success posts to `/api/razorpay/verify-payment`.
7. Backend verifies signature, extends plan expiry, records payment ID and amount, and merges same-billing-day add-ons once.
8. Profile refreshes.

### 6.7 Razorpay Payment Flow

```mermaid
flowchart TD
  A["Frontend selects plan or bill"] --> B["POST /api/razorpay/create-order"]
  B --> C["Backend loads PlanSetting and calculates amount"]
  C --> D["Razorpay order created with notes"]
  D --> E["Frontend opens Razorpay Checkout"]
  E --> F{"Payment success?"}
  F -->|No| G["Payment cancelled/failed"]
  F -->|Yes| H["POST /api/razorpay/verify-payment"]
  H --> I["Verify HMAC signature"]
  I --> J["Fetch Razorpay order notes"]
  J --> K["Create/update Admin plan and billing fields"]
  K --> L["Set planActivatedAt, planExpiresAt, payment IDs"]
  L --> M["Return success and refresh UI"]
  D --> N["Webhook fallback /api/razorpay/webhook"]
  N --> K
```

### 6.8 Employee Management CRUD

1. Admin opens employee management.
2. `EmployeeProvider` fetches employees through `/api/employees`.
3. Admin creates employee with `/api/employees`.
4. Backend checks user limit using base plan limit plus active add-ons.
5. Employee is stored with `adminId`, `company`, company snapshot fields, login fields, personal/bank/experience details.
6. Admin can update, deactivate, reactivate, delete, change password, and clear old email.
7. UI state refreshes or updates provider state.

### 6.9 Support Admin Management

1. Admin opens support admin management page.
2. Page loads `/api/admin/profile` and `/api/admin/support-admins`.
3. Admin creates support admin with support admin ID, position name, email, password, and assigned features.
4. Backend stores a `SupportAdmin` with `adminId`.
5. Admin can update position, login status, department, phone, password, and features.
6. Support Admin logs in and inherits tenant scope from `adminId`.

### 6.10 Notification Flow

1. Admin or system creates notification using `/api/notifications`.
2. Notification stores `adminId`, optional `companyId`, optional `userId`, `role`, title, message, type, and read state.
3. Employee/Admin fetches `/api/notifications`.
4. Backend builds a scoped filter:
   - Admin/support-admin sees notifications for their root admin tenant.
   - Employee sees direct notifications and company-scoped employee broadcasts.
5. User marks one or all notifications read.
6. UI counters and notification lists update.

```mermaid
flowchart TD
  A["Event or admin creates notification"] --> B["Notification model"]
  B --> C{"Target"}
  C -->|Admin tenant| D["adminId scoped"]
  C -->|Employee company| E["companyId scoped"]
  C -->|Direct user| F["userId scoped"]
  D --> G["GET /api/notifications"]
  E --> G
  F --> G
  G --> H["buildNotificationFilterForUser"]
  H --> I["Return visible notifications"]
  I --> J["UI unread counter/list"]
  J --> K["Mark read/clear"]
```

### 6.11 Daily Work Tracker

1. Employee opens daily work tracker.
2. Frontend uses `/api/work` routes.
3. Employee submits work entries, percentages, and optional images.
4. Backend stores work entries/images and calculates daily/monthly performance using utility logic.
5. Admin uses `/api/work/admin` routes to review team work data.

### 6.12 Document Verification

1. Admin/support-admin invites a candidate/employee through `/api/doc-verification/invite` or `/bulk-invite`.
2. Backend creates `DocumentVerification` with token, company, required documents, and status fields.
3. Candidate opens `/document-verification` with token.
4. Public token route validates token and allows file upload/submit.
5. Files are uploaded and stored with document metadata.
6. Admin lists company/all records and verifies individual documents or all documents.
7. Notes and status are stored on the verification record.

## 7. Backend Workflow

### Route to Database Pattern

```mermaid
flowchart LR
  A["HTTP request"] --> B["Express route"]
  B --> C["Middleware: CORS/body parser/protect/RBAC"]
  C --> D["Controller or route handler"]
  D --> E["Validate input and tenant scope"]
  E --> F["Mongoose model"]
  F --> G["MongoDB collection"]
  G --> H["Controller formats response"]
  H --> I["JSON response"]
```

### JWT Verification

- Tokens are signed with `JWT_SECRET`.
- Normal users are resolved by checking Admin, SupportAdmin, then Employee.
- Master Admin uses `protectMaster`.
- Middleware attaches `req.user`.
- For support admins and created admins, `actualId` preserves the real user while `_id` may be mapped to root admin for tenant operations.
- Subscription guard checks root Admin plan expiry plus 7-day grace period.

### RBAC Checks

- Frontend `ProtectedRoute` checks allowed roles.
- Backend `onlyAdmin` restricts admin-only actions.
- `restrictTo` is used in document verification and similar modules.
- Support Admin access is partly controlled through `assignedFeatures`.

### Error Handling

- Route handlers generally use `try/catch`.
- Common responses:
  - `400` invalid request
  - `401` missing/invalid auth
  - `403` unauthorized, disabled login, or expired subscription
  - `404` not found
  - `500` server error
- Global API 404 and error handlers are defined in `app.js`.

### Socket.IO Events

- Socket.IO is initialized in `app.js`.
- Clients can register/authenticate by user ID.
- Request workflows emit events such as:
  - `punchout:new`
  - `punchout:updated`
- Controllers can access Socket.IO through `req.app.get("io")`.

## 8. Frontend Workflow

### Page Load

1. React Router matches route.
2. PublicRoute/ProtectedRoute validates session.
3. Layout mounts.
4. Context providers load shared data.
5. Page component loads page-specific data.
6. Loading state renders spinner/skeleton.
7. Response data is stored in state and rendered.

### API Call Flow

```mermaid
flowchart TD
  A["Component event/useEffect"] --> B["api.js function or api.get/post"]
  B --> C["Axios request interceptor"]
  C --> D["Attach master/admin/employee token"]
  D --> E["Backend API"]
  E --> F["Response interceptor"]
  F --> G["Component setState/context update"]
  G --> H["UI render"]
```

### State Management

- Auth state: `AuthProvider`.
- Employees: `EmployeeProvider`.
- Attendance: `AttendanceProvider` plus employee-specific providers.
- Leave: `LeaveRequestProvider` and employee leave providers.
- Overtime: `OvertimeProvider`.
- Notices/notifications: `NoticeProvider`, `NotificationProvider`, employee notification providers.
- Local state: forms, modals, filters, pagination, loading flags, and request processing flags.

### Modal/Form Submission

1. User opens modal/form.
2. Component validates local fields.
3. Submit button sets loading flag.
4. API request is sent.
5. Success closes modal, resets form, refreshes data, and shows alert/toast.
6. Failure shows error through SweetAlert, alert, toast, or inline message.

### Protected Routing

- Master routes require `masterToken`.
- Admin/support-admin routes require user role in `["admin", "support-admin"]`.
- Employee routes require role `employee`.
- Public route redirects already logged-in users to their dashboard.

## 9. Database Workflow

### Main Collections and Responsibilities

| Model | Purpose |
| --- | --- |
| `Admin` | Tenant owner, subscription, billing, base user limit, add-ons |
| `SupportAdmin` | Delegated admin user linked to Admin |
| `Employee` | Employee profile, login, company mapping, personal/bank/experience data |
| `Company` | Company entity under Admin |
| `Attendance` | Per-employee daily attendance sessions and status requests |
| `LeaveRequest` | Leave applications and approval lifecycle |
| `LeavePolicy` | Admin-specific leave policy and paid-day rules |
| `Overtime` | Overtime applications and approval lifecycle |
| `PunchOutRequest` | Employee punch-out correction requests |
| `PayrollRecord` | Saved monthly payroll and payslip data |
| `PayrollRule` | Admin payroll configuration |
| `Notification` | Tenant-scoped notifications |
| `Notice` | Admin announcements/notices and replies |
| `DailyWorkEntry` / `WorkImage` | Daily work tracker data and images |
| `DocumentVerification` | Candidate/employee document verification token flow |
| `PlanSetting` | Subscription plan duration, price, billing cycle, max users, features |
| `MasterAdmin` | Platform master account |
| `FaceDescriptor` / `WebAuthnCredential` | Biometric login setup |
| `Shift` / `OfficeSettings` | Shift and location settings |
| `Group` | Employee/team grouping |
| `Resignation`, `WelcomeKit`, `InductionDispatch` | HR lifecycle workflows |

### Tenant Isolation

- `Admin` owns the tenant.
- `Company` is linked to Admin.
- `Employee` stores `adminId` and `company`.
- `SupportAdmin` stores `adminId`.
- Attendance, leave, payroll, notifications, documents, groups, shifts, and requests usually store `adminId` and/or `companyId`.
- Backend queries filter by `req.user._id`, `req.user.adminId`, or resolved root Admin.

### Employee-to-Admin Mapping

```mermaid
flowchart TD
  A["Admin"] --> B["Company"]
  A --> C["SupportAdmin"]
  A --> D["Employee"]
  B --> D
  D --> E["Attendance"]
  D --> F["LeaveRequest"]
  D --> G["Overtime"]
  D --> H["PayrollRecord"]
  D --> I["DailyWorkEntry"]
  D --> J["DocumentVerification"]
```

### Database Relationship Flow

```mermaid
erDiagram
  ADMIN ||--o{ COMPANY : owns
  ADMIN ||--o{ SUPPORT_ADMIN : delegates
  ADMIN ||--o{ EMPLOYEE : manages
  COMPANY ||--o{ EMPLOYEE : contains
  EMPLOYEE ||--|| ATTENDANCE : has
  EMPLOYEE ||--o{ LEAVE_REQUEST : submits
  EMPLOYEE ||--o{ OVERTIME : submits
  EMPLOYEE ||--o{ PAYROLL_RECORD : receives
  EMPLOYEE ||--o{ PUNCH_OUT_REQUEST : submits
  ADMIN ||--o{ NOTIFICATION : scopes
  COMPANY ||--o{ NOTIFICATION : broadcasts
  ADMIN ||--o{ PLAN_SETTING : uses
  ADMIN ||--o{ DOCUMENT_VERIFICATION : invites
```

## 10. Codebase Route Map

The backend route registry in `BACKEND/app.js` mounts the HRMS modules as follows:

| Base API | Main Responsibility |
| --- | --- |
| `/api/auth` | Employee/general login |
| `/api/admin` | Admin auth, profile, plans, support admins, location settings |
| `/api/master` | Master Admin login and platform admin listing/settings |
| `/api/employees` | Employee CRUD, activation/deactivation, document upload, user limit enforcement |
| `/api/companies` | Company CRUD and employee ID generation |
| `/api/attendance` | Employee attendance, punch-in/out, corrections, full-day requests, admin attendance reports |
| `/api/admin/attendance` | Admin attendance range utilities |
| `/api/punchoutreq` | Punch-out correction request lifecycle |
| `/api/leaves` | Leave application, approval, policy, balance, cancellation |
| `/api/overtime` | Overtime application, approval, cancellation |
| `/api/payroll` | Payroll rules, batch save, payroll candidates, employee payroll records |
| `/api/notifications` | Notification CRUD/read-state flow |
| `/api/notices` | Admin notices, replies, notice board |
| `/api/work` | Employee daily work tracker |
| `/api/work/admin` | Admin work tracker review and analytics |
| `/api/doc-verification` | Document verification invite/token/upload/admin review |
| `/api/razorpay` | Subscription orders, payment verification, add-ons, billing history |
| `/api/shifts` | Shift assignment and shift lookup |
| `/api/work-mode` | Work mode request and approval |
| `/api/rules` | Admin rules/images and employee rule view |
| `/api/profile` | Profile picture upload/read/delete |
| `/api/issues` | Admin/employee/master issue tracking |
| `/api/induction` | Induction dispatch/history |
| `/api/resignations` | Employee resignation and admin exit workflow |
| `/api/welcome-kit` | Welcome kit checklist/return/status |
| `/api/domain` | Tenant domain/subdomain settings |
| `/api/face-auth` | Face login/register/status |
| `/api/webauthn` | Fingerprint/WebAuthn register/login/credentials |

## 11. Frontend Route Map

The React router in `FRONTEND/src/App.jsx` groups the application into public, master, admin/support-admin, and employee sections.

| Route Group | Layout/Protection | Representative Pages |
| --- | --- | --- |
| Public | `PublicRoute` | `/`, `/login`, `/request-demo`, `/payment-success`, `/employee-onboarding`, `/document-verification` |
| Master | `ProtectedMasterRoute` + `LayoutMaster` | `/master/dashboard`, `/master/admins`, `/master/settings`, `/master/manage-logins`, `/master/manage-issues`, `/master/domain-settings` |
| Admin/Support Admin | `ProtectedRoute allow={["admin","support-admin"]}` + `LayoutAdmin` | `/admin/dashboard`, `/employees`, `/attendance`, `/leave-management`, `/admin/payroll`, `/admin/doc-verify-portal`, `/support-admin/dashboard` |
| Employee | `ProtectedRoute role="employee"` + `LayoutEmployee` | `/employee/dashboard`, `/employee/attendance`, `/employee/leave-management`, `/employee/empovertime`, `/employee/daily-work-tracker`, `/employee/payslip` |

Important frontend providers:

- `AuthProvider`: restores session and performs admin-first, employee-fallback login.
- `EmployeeProvider`: loads and mutates employee state for admin/support-admin screens.
- `AttendanceProvider`: wraps attendance state and dashboard data.
- `LeaveRequestProvider`: maintains leave requests and approval state.
- `OvertimeProvider`: maintains overtime request state.
- `NoticeProvider` and notification providers: notice board and notification state.
- `CurrentEmployee*Provider`: employee-specific attendance, leave, notification, and settings state.

## 12. Extended Module Workflow Diagrams

### 12.1 Leave Approval Workflow

```mermaid
flowchart TD
  A["Employee/Support Admin submits leave form"] --> B["POST /api/leaves/apply"]
  B --> C["protect middleware resolves user and tenant"]
  C --> D["leaveController validates dates, type, reason, requester type"]
  D --> E["Resolve LeavePolicy for adminId"]
  E --> F["Calculate paid/unpaid split and details per date"]
  F --> G["Create LeaveRequest with Pending status"]
  G --> H["Admin opens leave approval page"]
  H --> I["GET /api/leaves"]
  I --> J["Admin approves/rejects"]
  J --> K{"Action"}
  K -->|Approve| L["PATCH /api/leaves/:id/approve"]
  K -->|Reject| M["PATCH /api/leaves/:id/reject"]
  L --> N["Update status/actionDate/approvedBy and policy counters"]
  M --> O["Update status/actionDate/admin response"]
  N --> P["Frontend refreshes leave list/summary"]
  O --> P
```

### 12.2 Payroll Generation Workflow

```mermaid
flowchart TD
  A["Admin opens payroll page"] --> B["Load employees, attendance, leave, payroll rules"]
  B --> C["Admin selects month and company/employee set"]
  C --> D["Frontend calculates salary preview"]
  D --> E["Attendance summary: full days, half days, absences, late days"]
  E --> F["Leave summary: paid leave, unpaid leave, LOP"]
  F --> G["Apply PayrollRule allowances and deductions"]
  G --> H["Calculate gross, deductions, net payable"]
  H --> I["POST /api/payroll/save-batch"]
  I --> J["safeAdminCheck and tenant scope"]
  J --> K["Upsert PayrollRecord by adminId + employeeId + month"]
  K --> L["Admin sees saved payroll"]
  L --> M["Employee fetches /api/payroll/record/:employeeId"]
  M --> N["Payslip UI/PDF displays payroll record"]
```

### 12.3 Employee CRUD and User Limit Workflow

```mermaid
flowchart TD
  A["Admin opens Employee Management"] --> B["EmployeeProvider calls GET /api/employees"]
  B --> C["Admin creates employee"]
  C --> D["POST /api/employees"]
  D --> E["protect + onlyAdmin"]
  E --> F["checkUserLimit(adminId)"]
  F --> G["Base admin.userLimit + active non-merged add-ons"]
  G --> H{"Limit available?"}
  H -->|No| I["Return limit error"]
  H -->|Yes| J["Create Employee with adminId and company"]
  J --> K["Optional document upload/company docs"]
  K --> L["EmployeeProvider updates state"]
  L --> M["Admin can edit/deactivate/reactivate/delete/change password"]
```

### 12.4 Support Admin Management Workflow

```mermaid
flowchart TD
  A["Admin opens SupportAdminManagement"] --> B["GET /api/admin/profile"]
  A --> C["GET /api/admin/support-admins"]
  C --> D["Render support admin table/cards"]
  D --> E["Admin creates support admin"]
  E --> F["POST /api/admin/support-admins"]
  F --> G["Create SupportAdmin with adminId, supportAdminId, positionName, assignedFeatures"]
  G --> H["Support admin logs in"]
  H --> I["Backend resolves root admin through adminId"]
  I --> J["Frontend routes to /support-admin/dashboard"]
  J --> K["Assigned feature/sidebar permissions control visible workflows"]
```

### 12.5 Work Mode Request Workflow

```mermaid
flowchart TD
  A["Employee requests work mode change"] --> B["POST /api/work-mode/request"]
  B --> C["Create WorkModeRequest scoped to admin/company/employee"]
  C --> D["Admin dashboard/sidebar counts pending request"]
  D --> E["GET /api/work-mode/pending-requests"]
  E --> F["Admin approves or rejects"]
  F --> G["PUT /api/work-mode/request/:id"]
  G --> H["Request status updated"]
  H --> I["Employee/admin UI refreshes"]
```

### 12.6 Daily Work Tracker Workflow

```mermaid
flowchart TD
  A["Employee opens daily work tracker"] --> B["GET /api/work employee routes"]
  B --> C["Employee submits task/progress/images"]
  C --> D["DailyWorkEntry and WorkImage saved"]
  D --> E["monthlyPerformance utility calculates percentage"]
  E --> F["Employee sees daily/monthly progress"]
  F --> G["Admin opens work tracker review"]
  G --> H["GET /api/work/admin routes"]
  H --> I["Admin reviews employee work entries and performance"]
```

### 12.7 Document Verification Workflow

```mermaid
flowchart TD
  A["Admin/support-admin invites candidate"] --> B["POST /api/doc-verification/invite"]
  B --> C["Create DocumentVerification token and required documents"]
  C --> D["Email/form link sent to candidate"]
  D --> E["Candidate opens /document-verification with token"]
  E --> F["GET /api/doc-verification/by-token/:token"]
  F --> G["Candidate uploads documents"]
  G --> H["POST /api/doc-verification/upload-doc/:token"]
  H --> I["Candidate submits verification"]
  I --> J["POST /api/doc-verification/submit/:token"]
  J --> K["Admin lists records"]
  K --> L["GET /api/doc-verification/company/:companyId or /all"]
  L --> M["Admin verifies doc or all docs"]
  M --> N["PATCH /verify-doc/:id or /verify-all/:id"]
```

### 12.8 Issue Management Workflow

```mermaid
flowchart TD
  A["Employee/Admin raises issue"] --> B["POST /api/issues"]
  B --> C["Issue route resolves user with setUser"]
  C --> D["Store TechnicalIssue with role, adminId/company context, images"]
  D --> E["Admin or Master views issue list"]
  E --> F["Status/action update"]
  F --> G["Issue record updated and optional email notification sent"]
  G --> H["Reporter sees latest status"]
```

### 12.9 Subscription Access Enforcement Workflow

```mermaid
flowchart TD
  A["Login or protected API request"] --> B["Resolve current user"]
  B --> C["Resolve root Admin"]
  C --> D["Load PlanSetting"]
  D --> E{"Owner/unlimited plan?"}
  E -->|Yes| F["Allow access"]
  E -->|No| G["Check planExpiresAt + 7 day grace"]
  G --> H{"Grace period ended?"}
  H -->|No| F
  H -->|Yes| I["Return 403 expired payload"]
  I --> J["Frontend shows expired/payment flow"]
```

### 12.10 Biometric Login Workflow

```mermaid
flowchart TD
  A["User opens face/fingerprint setup"] --> B["Protected setup route"]
  B --> C{"Method"}
  C -->|Face| D["POST /api/face-auth/register"]
  C -->|WebAuthn| E["POST /api/webauthn/register/options and /verify"]
  D --> F["Store FaceDescriptor"]
  E --> G["Store WebAuthnCredential"]
  H["Biometric login attempt"] --> I{"Method"}
  I -->|Face| J["POST /api/face-auth/login"]
  I -->|Fingerprint| K["POST /api/webauthn/login/options and /verify"]
  J --> L["Resolve user and role"]
  K --> L
  L --> M["Return JWT and login method"]
  M --> N["Frontend stores session and routes by role"]
```

## 13. End-to-End HRMS Lifecycle

```mermaid
flowchart TD
  A["Master/Admin configures plans and subscription"] --> B["Admin account active"]
  B --> C["Admin creates company"]
  C --> D["Admin creates employees/support admins"]
  D --> E["Employees complete onboarding/documents"]
  E --> F["Daily operations begin"]
  F --> G["Attendance punch in/out"]
  F --> H["Leave/overtime/work-mode requests"]
  F --> I["Daily work tracker and notices"]
  G --> J["Monthly attendance summary"]
  H --> J
  I --> J
  J --> K["Payroll generation and payslip"]
  K --> L["Reports, issues, resignations, welcome kit, induction"]
  L --> M["Subscription renewal/add-on billing"]
  M --> B
```

## 14. Interview Explanation Summary

This HRMS works as a tenant-based SaaS system. The Admin is the tenant owner, and almost every operational record is scoped through `adminId` and often `companyId`. Authentication returns a JWT and role, which the frontend stores in session storage. React protects routes by role, while the backend verifies tokens, resolves the actual user, checks RBAC, and enforces subscription status.

Operational modules follow a consistent pattern:

1. User action in React.
2. Axios request with JWT.
3. Express route receives request.
4. Middleware validates auth, role, tenant, and subscription.
5. Controller validates input and applies business rules.
6. Mongoose model reads/writes MongoDB.
7. Optional Socket.IO, email, notification, or payment provider integration runs.
8. JSON response updates React state and UI.

The most important architecture points are tenant isolation, role-based access, modular HR workflows, subscription billing enforcement, and real-time/request-driven updates.
