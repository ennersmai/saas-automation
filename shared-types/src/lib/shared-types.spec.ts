import {
  DEFAULT_TENANT_CONTEXT,
  SCHEDULED_MESSAGE_TRIGGERS,
  ScheduledMessageTrigger,
} from './shared-types';

describe('shared-types', () => {
  it('exposes the scheduled message trigger list', () => {
    const expected: ScheduledMessageTrigger[] = [
      'booking-confirmation',
      'pre-arrival-24h',
      'pre-arrival-3h',
      'same-day-instant',
      'post-booking-thanks',
      'checkout-morning',
    ];

    expect(SCHEDULED_MESSAGE_TRIGGERS).toEqual(expected);
  });

  it('provides a default tenant context scaffold', () => {
    expect(DEFAULT_TENANT_CONTEXT).toMatchObject({
      tenantId: '',
      role: 'client-tenant',
    });
  });
});
