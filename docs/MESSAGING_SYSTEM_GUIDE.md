# PPA System Messaging System - Setup & Usage Guide

## Overview
The Central Hardwares PPA System now has a complete in-app messaging system that allows staff, admin, and technicians to send and receive SMS messages to customers and each other, with full message history tracking.

## What's New

### 1. **Proper SMS Sending**
- Messages are now sent through the system database (not relying on device SMS apps)
- All messages are stored for history and reference
- Role-based permissions ensure proper access control

### 2. **Message Storage & History**
- Every message sent is logged in the database
- Access message history through the message history viewer
- Track all communications with customers and technicians

### 3. **User Interface**
- **Send Message Button** ("Msg"): Opens a modal to send messages to customer and technician
- **History Button** ("History"): View all messages sent to a specific phone number
- **Message Modal**: Shows message content and allows sending with one click

---

## How to Use

### For Staff & Admin

#### Sending Messages to Service Assignment
1. Open a Service record
2. Look for the **"Msg"** button (envelope icon) in the service actions
3. Click it to open the "Send Assignment Messages" modal
4. The modal shows:
   - **Message to Customer**: Pre-filled message about the service assignment
   - **Message to Technician**: Pre-filled message with job details
5. Click the respective **Send** buttons to send messages
6. Both messages are saved in the database automatically

#### Viewing Message History
1. In the Service record, click the **"History"** button
2. A modal opens showing all messages sent to that contact
3. Messages show:
   - Sender name
   - Date & time sent
   - Full message content
   - Associated service type

#### Sending Custom Notifications
1. Open a Service record and click **"Finish Service"** or **"Mark as Completed"**
2. The system automatically sends a completion notification message
3. Messages can be sent to customer email or phone

---

## Technical Architecture

### Database Tables

#### `messages` Table
Stores all SMS/in-app messages:
```
- id: Unique message ID
- from_user_id: Staff/Admin ID who sent the message
- from_role: Role of sender (Admin/Staff)
- to_phone: Recipient phone number
- to_name: Recipient name
- to_role: Recipient type (Customer/Technician)
- message: Full message text
- service_id: Associated service ID (if any)
- status: sent/pending/failed
- created_at: When message was sent
- updated_at: Last update time
```

### API Endpoints

#### Send Message
**Endpoint**: `POST /api/messages.php?action=send`

Request Body:
```json
{
  "to_phone": "+94771234567",
  "to_name": "John Doe",
  "to_role": "Customer",
  "message": "Your service is ready",
  "service_id": "SVC001"
}
```

Response:
```json
{
  "success": true,
  "message": "Message sent successfully",
  "message_id": 123,
  "data": { ... }
}
```

#### Get Message History
**Endpoint**: `GET /api/messages.php?action=history&phone={phone_number}`

Response:
```json
{
  "success": true,
  "phone": "+94771234567",
  "messages": [ ... ],
  "count": 5
}
```

#### List All Messages
**Endpoint**: `GET /api/messages.php?action=list&limit=50&offset=0`

Optional Filters:
- `phone`: Filter by phone number
- `service_id`: Filter by service ID
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset

---

## Role-Based Access Control

### Admin & Staff Can:
- ✅ Send messages to customers
- ✅ Send messages to technicians
- ✅ View message history
- ✅ See all sent messages with timestamps

### Technicians Can:
- ✅ Receive messages about assignments
- ✅ View message history

### Customers Can:
- ✅ Receive service notifications
- ✅ View message history (future feature)

---

## Features

### Message Sending
- **Pre-filled Templates**: Service messages are pre-filled with relevant information
- **One-Click Sending**: Send both customer and technician messages with separate buttons
- **Phone Validation**: Automatic phone number cleaning and validation
- **Error Handling**: Clear error messages if phone is invalid or missing

### Message History Viewer
- **Beautiful UI**: Clean, modern message display
- **Sorted by Date**: Messages sorted most recent first
- **Service Linking**: Shows associated service type with each message
- **User Information**: Displays sender name and timestamp

### Activity Logging
- All message sends are logged to `activity_logs` table
- Includes sender, recipient, and message details
- Helps track communication history

---

## Database Setup

The messaging table is automatically created on first run. The system checks for and creates the `messages` table with:

```sql
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_user_id INT NOT NULL,
    from_role VARCHAR(50) NOT NULL,
    to_phone VARCHAR(20) NOT NULL,
    to_name VARCHAR(100),
    to_role VARCHAR(50),
    message TEXT NOT NULL,
    service_id VARCHAR(20) DEFAULT NULL,
    status ENUM('sent', 'pending', 'failed') DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_phone (to_phone),
    INDEX idx_service (service_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Troubleshooting

### Issue: "Message not sending"
**Solution**: 
- Check that phone number is valid
- Ensure you have permission to send messages
- Check database connection in `api/config.php`

### Issue: "Phone number invalid"
**Solution**:
- Ensure the phone number has at least 7 digits
- Remove special characters except leading +
- Use format like: `+94771234567` or `0771234567`

### Issue: "Message history not loading"
**Solution**:
- Verify database has `messages` table created
- Check that API endpoint is reachable
- Verify user is authenticated

### Issue: "API returns 401 Unauthorized"
**Solution**:
- Ensure you are logged in
- Check session cookies are enabled
- Clear browser cache and try again

---

## Files Modified

1. **database.sql**
   - Added `messages` table schema

2. **api/config.php**
   - Added `messages` table creation in `ensureTables()` function

3. **api/messages.php** (NEW)
   - Handles message sending
   - Retrieves message history
   - Manages message list operations

4. **services.js**
   - Added `sendMessageViaAPI()` function
   - Updated `showSmsModal()` for new API
   - Added `showMessageHistory()` function
   - Updated `sendCustomerNotification()` to use new API
   - Added message history button to service actions

---

## Future Enhancements

Potential improvements for the messaging system:
- SMS gateway integration (Twilio, AWS SNS)
- Two-way SMS reply handling
- Message read receipts
- Message scheduling
- Template management
- Bulk messaging capability
- Chat interface (two-way messaging)
- Media attachments
- WhatsApp/Telegram integration

---

## Support

For issues or questions about the messaging system:
1. Check the troubleshooting section above
2. Verify all database tables are created
3. Check browser console for JavaScript errors
4. Verify API endpoints are responding correctly
5. Review activity logs for transaction history

---

**Version**: 1.0
**Last Updated**: April 27, 2026
**System**: Central Hardwares PPA - Final Phase
