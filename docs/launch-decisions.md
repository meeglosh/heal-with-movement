# Launch decisions from Heidi

This is the durable record of Heidi's launch answers. It records policy and
content decisions, not whether the website or booking system has implemented
them. See [open implementation and follow-up items](#open-items) before launch.

## Confirmed decisions

### Services, rates, and payment

- Montreal private lesson: CAD $85 per 60-minute session.
- Vermont private lesson: USD $80 per 60-minute session.
- Virtual private lesson: CAD $40 per 60-minute session.
- Virtual group package: USD $90 for six classes. The credits can be used at
  any time and do not expire.
- Virtual group drop-in: USD $20 for a single class, paid by card at booking.
  Heidi added this on October 6, 2026, replacing her earlier "no drop-in"
  answer.
- Adult and child private lessons use the same price.
- Virtual private and virtual group bookings are paid by card online at
  booking. In-person sessions are invoiced after the visit.
- Heidi's earlier preference was three weeks per month in Montreal and one
  week per month in Chittenden County, Vermont. Montreal is the default
  location; Vermont should be offered only when its Cal.com availability is
  explicitly configured. This is not the active schedule: exact days, times,
  availability, and in-person addresses are still to be supplied.
- The two group-class time choices are Tuesday at 7:00 p.m. Eastern and
  Wednesday at noon Eastern, for no more than two classes per week. The first
  class date is October 13, 2026. Group times should be visible before sign-in
  and intake, and the public calendar should show two months ahead. The
  Tuesday evening class is an exception to the normal daytime schedule.
- Group capacity is 50 maximum. Classes are for adults of all fitness levels
  and older children; an age threshold of 12+ is provisional. Whether a parent
  must participate with a child remains undecided.
- Cal Video will be used to start for virtual private lessons and group
  classes.
- No street address should be published. Share the full address after booking.
- The booking minimum is two hours in advance, with zero buffer between
  sessions.
- Session length is 60 minutes.
- Cancellations with less than 24 hours' notice and no-shows forfeit the
  payment or class credit, unless Heidi waives it; emergencies are one example
  for a waiver. When Heidi grants an exception, staff should be able to restore
  a credit for a future booking or issue a full refund.
- Heidi approves the first private booking for a child. Later private child
  bookings do not need her approval under the intended policy.
- If Heidi cancels, the client pays no charge; Heidi apologizes and offers to
  reschedule. A prepaid group-class credit remains unused when Heidi cancels.
- Online group and private sessions may be recorded occasionally, only after
  explicit consent. Only Heidi receives a recording; she keeps it for one
  month and deletes it.

### Content, identity, and operations

- Service descriptions and current testimonials are approved.
- Public contact is `heidi@healwithmovement.com`; do not publish a phone number.
- Newsletter signup is deferred until a service and consent language are
  supplied.
- Use the identity “Heidi Rood, operating as Heal with Movement.” Heidi
  indicated that a separate legal business name is not applicable.
- Site policies should be included in the intake forms.
- Retain adult and child records for five years unless the client requests
  earlier deletion.
- Heidi Rood is the only staff member who may access account and intake
  records.
- Use `heidi@healwithmovement.com` as the email sender and reply-to address.
- Heidi's biography has been supplied and applied in the site content.

## Open items

- Stripe checkout is built and uses a test-mode key: virtual private lessons
  are paid at booking, and group classes use six-class credit packages. Before
  launch it needs a live-mode key and a live-mode webhook endpoint, then a
  deploy. The payments migration is applied in production.
- Cancellations at least 24 hours ahead and Heidi's rejections now refund
  the lesson or return the credit automatically; later ones forfeit. Still
  missing: a staff tool to waive a forfeit by restoring a credit (refunds can
  be issued in the Stripe Dashboard). Align
  intake wording with this decision and test both virtual credits and paid
  private bookings. The current booking system has no credit or refund tools.
- The earlier monthly location split is only a preference, not active
  availability. Exact in-person days and time windows, both street addresses,
  and Vermont Cal.com availability are outstanding. Keep Montreal as the
  default until Vermont is explicitly configured.
- The 12+ child age threshold is provisional, and parent participation is
  undecided.
- The current private-child configuration requests approval for every
  booking. Supporting first-booking-only approval requires implementation and
  matching Cal.com configuration before this decision can be honored.
- Explicit consent is required before recording, but the consent process and
  what happens when a group participant declines have not been specified.
- Site-policy language still needs review and the requested intake-form
  inclusion. A legal jurisdiction and the legal registration details were not
  provided.
- The newsletter is deferred. Heidi's biography has been supplied and applied
  in the site content.

## Implementation status

These are decisions to implement, not a claim that production is configured.
Prices, payment collection, schedules, public group availability, participant
limits, cancellation terms, recording controls, and approval behavior must be
implemented and verified before they are represented as active booking rules.
The website backend currently rejects paid Cal.com event types until checkout
is implemented. The production scheduler still needs configuration to match
the decisions above; the current setup uses the same Monday–Friday,
10:00 a.m.–5:00 p.m. Eastern schedule across services, has no payment or credit support, and requests approval for every
private child booking.
