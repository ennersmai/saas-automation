export interface TemplateResponseDto {
  id: string;
  tenant_id: string;
  trigger_type: string;
  name: string;
  template_body: string;
  enabled: boolean;
  variables: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

export const AVAILABLE_VARIABLES: TemplateVariable[] = [
  {
    name: 'guestName',
    description: "Guest's full name",
    example: 'John Smith',
  },
  {
    name: 'propertyName',
    description: 'Property/listing name',
    example: 'Cozy Downtown Apartment',
  },
  {
    name: 'doorCode',
    description: 'Access code for the property',
    example: '1234',
  },
  {
    name: 'wifiName',
    description: 'WiFi network name',
    example: 'Guest_WiFi',
  },
  {
    name: 'wifiPassword',
    description: 'WiFi password',
    example: 'welcome123',
  },
  {
    name: 'checkInDate',
    description: 'Check-in date',
    example: '2024-01-15',
  },
  {
    name: 'checkOutDate',
    description: 'Check-out date',
    example: '2024-01-17',
  },
];
