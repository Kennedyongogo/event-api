# TickaZone Commission Structure

## Overview

Commission rates in TickaZone are set **per event**, not per organizer. This allows flexibility for different ticket prices and event types.

## Why Per-Event Commission?

### The Problem with Per-Organizer Commission:

- Organizers host multiple events with varying ticket prices
- A flat commission rate doesn't work fairly across all event types
- Example:
  - Gospel Night ticket: KSh 500
  - Tech Summit ticket: KSh 5,000
  - Same 10% commission would be unfair to either platform or organizer

### The Solution: Per-Event Commission

- Each event has its own `commission_rate` field
- Admin can negotiate different rates based on:
  - Event type/category
  - Ticket price range
  - Venue size
  - Expected attendance
  - Partnership agreements

## Database Schema

### Event Model

```javascript
{
  id: UUID,
  organizer_id: UUID,
  event_name: STRING,
  // ... other fields
  commission_rate: DECIMAL(5,2), // e.g., 10.00 for 10%
  status: ENUM
}
```

### Event Organizer Model

```javascript
{
  id: UUID,
  organization_name: STRING,
  // ... other fields
  // NO commission_rate field here
  status: ENUM
}
```

## How It Works

### 1. Event Creation

When organizer creates an event:

```javascript
POST /api/events
{
  "event_name": "Nairobi Music Fest",
  "commission_rate": 10.0, // Optional, defaults to 10%
  // ... other fields
}
```

### 2. Admin Approval

Admin reviews event and can adjust commission rate:

```javascript
PUT /api/events/:id/approve
{
  "commission_rate": 12.0 // Admin sets final rate
}
```

### 3. Payment Split

When ticket is purchased:

```javascript
Ticket Price: KSh 1,000
Commission Rate: 10% (from event.commission_rate)

Platform Share: KSh 100
Organizer Share: KSh 900
```

## API Endpoints

### Create Event

```http
POST /api/events
Authorization: Bearer {organizer_token}
Content-Type: application/json

{
  "organizer_id": "uuid",
  "event_name": "My Event",
  "commission_rate": 10.0,  // Optional, default 10%
  // ... other fields
}
```

### Approve Event with Commission

```http
PUT /api/events/:id/approve
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "commission_rate": 12.0  // Optional, updates if provided
}
```

### Get Event (includes commission)

```http
GET /api/events/:id
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "event_name": "My Event",
    "commission_rate": "10.00",
    // ... other fields
  }
}
```

## Payment Flow

1. **User Buys Ticket**
   - System retrieves event details
   - Gets `commission_rate` from event record
2. **Calculate Split**

   ```javascript
   const commissionRate = event.commission_rate; // From Event model
   const amount = purchase.total_amount;
   const adminShare = (amount * commissionRate) / 100;
   const organizerShare = amount - adminShare;
   ```

3. **Create Payment Record**

   ```javascript
   Payment.create({
     purchase_id: purchase.id,
     amount: amount,
     admin_share: adminShare,
     organizer_share: organizerShare,
     status: "pending",
   });
   ```

4. **Pesapal Split Payment**
   ```javascript
   pesapal.initiatePayment({
     amount: amount,
     split_details: [
       {
         merchant_ref: organizer.pesapal_merchant_ref,
         percentage: 100 - commissionRate,
       },
       {
         merchant_ref: platform.pesapal_merchant_ref,
         percentage: commissionRate,
       },
     ],
   });
   ```

## Examples

### Example 1: Standard Event

```
Event: Community Concert
Ticket Price: KSh 1,000
Commission Rate: 10%

Result:
- Platform earns: KSh 100
- Organizer earns: KSh 900
```

### Example 2: Premium Event

```
Event: International Conference
Ticket Price: KSh 15,000
Commission Rate: 8% (negotiated lower for high-value event)

Result:
- Platform earns: KSh 1,200
- Organizer earns: KSh 13,800
```

### Example 3: Charity Event

```
Event: Fundraising Gala
Ticket Price: KSh 5,000
Commission Rate: 5% (reduced for charity)

Result:
- Platform earns: KSh 250
- Organizer earns: KSh 4,750
```

## Admin Dashboard Analytics

The analytics now track commission by event:

```http
GET /api/admins/analytics/revenue
```

Returns:

- Revenue by event
- Top performing events by commission
- Commission breakdown showing event-level data

## Migration Notes

If you had commission_rate in EventOrganizer model:

1. ✅ Removed from `event_organizers` table
2. ✅ Added to `events` table
3. ✅ Updated all payment calculations to use `event.commission_rate`
4. ✅ Updated analytics to group by event, not organizer

## Best Practices

1. **Default Rate**: Set a sensible default (10%) for new events
2. **Rate Range**: Keep commission between 5% - 20%
3. **Documentation**: Always document why specific rate was chosen
4. **Transparency**: Show commission rate to organizers when creating events
5. **Flexibility**: Allow admin to adjust during approval based on negotiation

## Future Enhancements

- [ ] Commission rate history tracking
- [ ] Automatic rate suggestions based on event type
- [ ] Tiered commission based on ticket sales volume
- [ ] Promotional periods with reduced commission
- [ ] Commission report generator per event
