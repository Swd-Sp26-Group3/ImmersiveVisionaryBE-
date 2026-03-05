export const TEST_REQUEST_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  KIT_SENT: 'Kit Sent',
  SAMPLE_INFO_SUBMITTED: 'Sample Info Submitted',
  IN_PROGRESS: 'In Progress',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  RESULTS_AVAILABLE: 'Results Available',
  CANCELLED: 'Cancelled'
} as const

export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
} as const

export const COLLECTION_METHOD = {
  AT_HOME: 'At Home',
  AT_FACILITY: 'At Facility'
} as const

export const TestRequestStatus = {
  INPUT_INFO: 'Input Infor',
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed'
}
