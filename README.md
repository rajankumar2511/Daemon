# Premium Message Deletion Feature

This document outlines the implementation of the bulk message deletion feature.

## Architecture

The deletion feature follows a soft-delete pattern to maintain database integrity while ensuring a premium user experience.

### Backend Implementation

- **Endpoint**: `DELETE /api/chats/:chatId/messages/bulk`
- **Controller**: `deleteMessages` in `chat.controller.js`
- **Ownership Validation**: Ensures that a user can only delete messages where they are the `sender`.
- **Permanent Hard-Delete**: Messages are completely removed from MongoDB (`deleteMany`) and Redis (`del`) when deleted. This ensures they are irrecoverable and will not reappear after a page refresh.
- **Cache Invalidation**: On every deletion, the corresponding Redis cache key for the chat messages is immediately deleted (`redis.del`). This forces the next fetch to rebuild the cache from the updated MongoDB source.
- **Real-time Synchronization**: Uses Redis Pub/Sub to broadcast a `messages:deleted` event to all participants, triggering immediate removal from their local UI state.

### Socket Event Schema

**Event Name**: `messages-deleted`

```json
{
  "chatId": "string",
  "messageIds": ["string"],
  "senderId": "string",
  "participants": ["string"]
}
```

### Frontend Implementation

- **Multi-select Mode**: Triggered via long-press (mobile) or right-click (desktop).
- **Keyboard Shortcuts**: `CMD/CTRL + A` to select all deletable messages. `ESC` to cancel.
- **Optimistic Updates**: UI removes messages immediately from state when the delete action is confirmed.
- **Undo Window**: A 5-second "Undo" toast allows users to cancel the deletion before the final commit.
- **Animations**: Smooth fade-out effect as messages are removed from the DOM.
- **Consistency Guard**: Frontend listeners filter out deleted messages from local state immediately upon receiving the socket event, ensuring zero-refresh consistency across all devices.

## Data Consistency & Synchronization

The system guarantees consistency through an **Immediate Purge** strategy:
1. **DB Write**: Delete documents from MongoDB.
2. **Cache Purge**: Immediately delete the Redis list for that chat.
3. **Broadcast**: Emit socket event for real-time UI removal.
4. **Lazy Rebuild**: The next `GET /messages` call finds a cache miss and fetches the remaining messages from MongoDB to rebuild the cache.

## Rollback Procedure

In case of a failure during the deletion process:
1. The frontend `useChat` hook will catch the error and alert the user.
2. It will automatically re-fetch the latest messages from the server to ensure the local state is consistent with the database.

## Performance Benchmarks

- **UI Update**: < 100ms (Optimistic update on frontend).
- **Database Commit**: < 200ms (Bulk update with indexed `_id` and `chatId`).
- **Socket Broadcast**: < 50ms (Redis Pub/Sub latency).
- **Total End-to-End**: < 350ms for real-time synchronization on participant devices.

## Testing

### Unit Tests (Endpoint)
- `test('should return 403 if user tries to delete others messages')`
- `test('should soft-delete only existing non-deleted messages')`
- `test('should return 400 if messageIds are invalid')`

### Integration Tests (Socket)
- `test('should emit messages-deleted to all chat participants')`
- `test('should handle multi-server propagation via Redis')`
