export interface CreateTenantOnSignupDto {
  tenantName: string;
  tenantSlug?: string;
  contactEmail?: string;
  contactPhone?: string;
  displayName?: string;
}
