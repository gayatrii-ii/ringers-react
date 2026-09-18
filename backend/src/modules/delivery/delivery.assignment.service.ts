import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES, RoleCode } from '../../constants/roles.js';
import { AuthService } from '../auth/auth.service.js';
import { WalletService } from '../payment/payment.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { SocketEvents } from '../../config/socket.js';

export interface AssignmentRecord {
  id: string;
  orderId: string;
  deliveryBoyId: string;
  status: string;
  assignedAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  rejectionReason?: string | null;
  failureReason?: string | null;
  failureNotes?: string | null;
}

export interface TrackingResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  deliveryStatus: string;
  deliveryBoy: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    vehicleType: string;
    vehicleNumber: string | null;
  } | null;
  latestLocation: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recordedAt: Date;
  } | null;
}

export class DeliveryAssignmentService {
  /**
   * 1. Vendor assigns a Delivery Partner to an order
   * STRICT: Only the vendor owner of this specific order can assign.
   */
  public static async assignRiderToOrder(
    orderId: string,
    assignerUserId: string,
    _assignerRoles: RoleCode[],
    targetRiderId: string
  ): Promise<AssignmentRecord> {
    // Check if assigner is a Vendor or trying to assign without vendor ownership
    return await withTransaction(async (client) => {
      // Fetch order and vendor store ownership
      const orderRes = await client.query<{
        id: string;
        order_number: string;
        vendor_id: string;
        customer_id: string;
        status: string;
        delivery_status: string;
        owner_user_id: string;
        business_name: string;
      }>(
        `SELECT o.id, o.order_number, o.vendor_id, o.customer_id, o.status, o.delivery_status,
                v.owner_user_id, v.business_name
         FROM order_management.orders o
         JOIN vendor.vendors v ON v.id = o.vendor_id
         WHERE o.id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
        throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
      }

      const order = orderRes.rows[0];

      // Authority rule: ONLY the vendor owner can assign riders to their order
      if (order.owner_user_id !== assignerUserId) {
        throw new AppError(
          'Only the vendor owning this store can assign a delivery partner to this order.',
          403,
          'VENDOR_ONLY_ACTION'
        );
      }

      // Validate order status is dispatchable (CONFIRMED or READY)
      const dispatchableStatuses = ['CONFIRMED', 'PREPARING', 'READY'];
      if (!dispatchableStatuses.includes(order.status)) {
        throw new AppError(
          `Cannot assign rider while order status is ${order.status}. Must be one of: [${dispatchableStatuses.join(', ')}]`,
          400,
          'INVALID_ORDER_STATE'
        );
      }

      // Check for an existing active assignment
      const existingAssignRes = await client.query(
        `SELECT id, status FROM delivery.delivery_assignments 
         WHERE order_id = $1 AND status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP') 
         LIMIT 1`,
        [orderId]
      );

      if (existingAssignRes.rows.length > 0) {
        throw new AppError(
          'An active delivery assignment already exists for this order. Reassign or cancel it first.',
          400,
          'ACTIVE_ASSIGNMENT_EXISTS'
        );
      }

      // Verify target rider exists, holds DELIVERY_BOY role, and is ONLINE
      const riderRes = await client.query<{
        id: string;
        first_name: string;
        last_name: string;
        phone: string;
        status: string;
      }>(
        `SELECT u.id, u.first_name, u.last_name, u.phone, COALESCE(dp.status, 'OFFLINE') as status
         FROM identity.users u
         JOIN identity.user_roles ur ON ur.user_id = u.id
         JOIN identity.roles r ON r.id = ur.role_id AND r.code = 'DELIVERY_BOY'
         LEFT JOIN delivery.delivery_profiles dp ON dp.user_id = u.id
         WHERE u.id = $1 AND u.deleted_at IS NULL AND u.status = 'ACTIVE'`,
        [targetRiderId]
      );

      if (riderRes.rows.length === 0 || !riderRes.rows[0]) {
        throw new AppError('Delivery partner account not found or is inactive.', 404, 'RIDER_NOT_FOUND');
      }

      const rider = riderRes.rows[0];

      if (rider.status !== 'ONLINE') {
        throw new AppError(
          `Selected rider is currently ${rider.status}. Only ONLINE riders can be assigned deliveries.`,
          400,
          'RIDER_NOT_AVAILABLE'
        );
      }

      // Insert assignment
      const assignRes = await client.query<{
        id: string;
        order_id: string;
        delivery_boy_id: string;
        status: string;
        assigned_at: Date;
      }>(
        `INSERT INTO delivery.delivery_assignments (order_id, delivery_boy_id, status)
         VALUES ($1, $2, 'ASSIGNED')
         RETURNING id, order_id, delivery_boy_id, status, assigned_at`,
        [orderId, targetRiderId]
      );

      const assignment = assignRes.rows[0]!;

      // Update order delivery_status
      await client.query(
        `UPDATE order_management.orders 
         SET delivery_status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [orderId]
      );

      // Record in status history
      await client.query(
        `INSERT INTO order_management.order_status_history (order_id, old_status, new_status, changed_by, reason)
         VALUES ($1, $2, $2, $3, $4)`,
        [
          orderId,
          order.status,
          assignerUserId,
          `Assigned to rider ${rider.first_name} ${rider.last_name} (${rider.phone})`,
        ]
      );

      // Real-time dispatch via Socket.IO
      SocketEvents.emitAssignmentCreated(targetRiderId, order.vendor_id, {
        assignmentId: assignment.id,
        orderId,
        orderNumber: order.order_number,
        vendorName: order.business_name,
        assignedAt: assignment.assigned_at,
      });

      // Send In-App & FCM Push Notification to Rider
      try {
        await NotificationService.createNotification({
          userId: targetRiderId,
          title: 'New Delivery Assigned',
          message: `You have been assigned order ${order.order_number} from ${order.business_name}.`,
          type: 'SYSTEM',
          referenceType: 'ORDER',
          referenceId: orderId,
        });
      } catch (err) {
        console.warn('Failed to send rider assignment notification:', err);
      }

      return {
        id: assignment.id,
        orderId: assignment.order_id,
        deliveryBoyId: assignment.delivery_boy_id,
        status: assignment.status,
        assignedAt: assignment.assigned_at,
        acceptedAt: null,
        pickedUpAt: null,
        deliveredAt: null,
      };
    });
  }

  /**
   * 2. Rider accepts assigned delivery
   */
  public static async acceptAssignment(
    assignmentId: string,
    riderUserId: string
  ): Promise<{ assignmentId: string; status: string; message: string }> {
    return await withTransaction(async (client) => {
      const assignRes = await client.query<{
        id: string;
        order_id: string;
        delivery_boy_id: string;
        status: string;
        vendor_id: string;
        customer_id: string;
        order_number: string;
        rider_name: string;
        rider_phone: string;
      }>(
        `SELECT da.id, da.order_id, da.delivery_boy_id, da.status,
                o.vendor_id, o.customer_id, o.order_number,
                u.first_name || ' ' || u.last_name as rider_name, u.phone as rider_phone
         FROM delivery.delivery_assignments da
         JOIN order_management.orders o ON o.id = da.order_id
         JOIN identity.users u ON u.id = da.delivery_boy_id
         WHERE da.id = $1 FOR UPDATE`,
        [assignmentId]
      );

      if (assignRes.rows.length === 0 || !assignRes.rows[0]) {
        throw new AppError('Delivery assignment not found.', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      const assign = assignRes.rows[0];

      if (assign.delivery_boy_id !== riderUserId) {
        throw new AppError('You are not authorized to accept this delivery assignment.', 403, 'FORBIDDEN');
      }

      if (assign.status !== 'ASSIGNED') {
        throw new AppError(
          `Cannot accept assignment in status "${assign.status}". Must be ASSIGNED.`,
          400,
          'INVALID_ASSIGNMENT_STATUS'
        );
      }

      // Update assignment status to ACCEPTED
      await client.query(
        `UPDATE delivery.delivery_assignments 
         SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [assignmentId]
      );

      // Update order delivery_status to ACCEPTED
      await client.query(
        `UPDATE order_management.orders 
         SET delivery_status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [assign.order_id]
      );

      // Switch rider status to BUSY
      await client.query(
        `UPDATE delivery.delivery_profiles 
         SET status = 'BUSY', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1`,
        [riderUserId]
      );

      // Real-Time Socket Event
      SocketEvents.emitAssignmentAccepted(assign.order_id, assign.customer_id, assign.vendor_id, {
        orderId: assign.order_id,
        assignmentId,
        riderName: assign.rider_name,
        riderPhone: assign.rider_phone,
      });

      return {
        assignmentId,
        status: 'ACCEPTED',
        message: 'Delivery assignment accepted. Proceed to vendor store for pickup.',
      };
    });
  }

  /**
   * 3. Rider rejects assigned delivery (Returns order to UNASSIGNED for vendor reassignment)
   */
  public static async rejectAssignment(
    assignmentId: string,
    riderUserId: string,
    reason: string
  ): Promise<{ assignmentId: string; status: string; message: string }> {
    return await withTransaction(async (client) => {
      const assignRes = await client.query<{
        id: string;
        order_id: string;
        delivery_boy_id: string;
        status: string;
        vendor_id: string;
        order_number: string;
        owner_user_id: string;
        rider_name: string;
      }>(
        `SELECT da.id, da.order_id, da.delivery_boy_id, da.status,
                o.vendor_id, o.order_number, v.owner_user_id,
                u.first_name || ' ' || u.last_name as rider_name
         FROM delivery.delivery_assignments da
         JOIN order_management.orders o ON o.id = da.order_id
         JOIN vendor.vendors v ON v.id = o.vendor_id
         JOIN identity.users u ON u.id = da.delivery_boy_id
         WHERE da.id = $1 FOR UPDATE`,
        [assignmentId]
      );

      if (assignRes.rows.length === 0 || !assignRes.rows[0]) {
        throw new AppError('Delivery assignment not found.', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      const assign = assignRes.rows[0];

      if (assign.delivery_boy_id !== riderUserId) {
        throw new AppError('You are not authorized to reject this assignment.', 403, 'FORBIDDEN');
      }

      if (assign.status !== 'ASSIGNED') {
        throw new AppError(
          `Cannot reject assignment in status "${assign.status}". Only pending assignments can be rejected.`,
          400,
          'INVALID_ASSIGNMENT_STATUS'
        );
      }

      // Update assignment to REJECTED
      await client.query(
        `UPDATE delivery.delivery_assignments 
         SET status = 'REJECTED', rejection_reason = $1, rejected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [reason.trim(), assignmentId]
      );

      // Reset order delivery_status to UNASSIGNED
      await client.query(
        `UPDATE order_management.orders 
         SET delivery_status = 'UNASSIGNED', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [assign.order_id]
      );

      // Rider status remains ONLINE
      await client.query(
        `UPDATE delivery.delivery_profiles 
         SET status = 'ONLINE', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1`,
        [riderUserId]
      );

      // Socket Event to notify vendor immediately
      SocketEvents.emitAssignmentRejected(assign.order_id, assign.vendor_id, {
        orderId: assign.order_id,
        assignmentId,
        orderNumber: assign.order_number,
        riderName: assign.rider_name,
        reason: reason.trim(),
      });

      // Notification to vendor store owner
      try {
        await NotificationService.createNotification({
          userId: assign.owner_user_id,
          title: 'Rider Rejected Assignment',
          message: `Rider ${assign.rider_name} declined delivery for order ${assign.order_number}. Reason: ${reason}. Please reassign.`,
          type: 'ORDER_ALERT',
          referenceType: 'ORDER',
          referenceId: assign.order_id,
        });
      } catch (err) {
        console.warn('Failed to notify vendor of rider rejection:', err);
      }

      return {
        assignmentId,
        status: 'REJECTED',
        message: 'Assignment rejected. Order returned to vendor for reassignment.',
      };
    });
  }

  /**
   * 4. Rider marks order PICKED UP & triggers delivery verification OTP to customer
   */
  public static async markPickedUp(
    assignmentId: string,
    riderUserId: string
  ): Promise<{ assignmentId: string; status: string; orderStatus: string; message: string }> {
    let customerPhoneToSendOtp: string | null = null;

    const result = await withTransaction(async (client) => {
      const assignRes = await client.query<{
        id: string;
        order_id: string;
        delivery_boy_id: string;
        status: string;
        order_status: string;
        order_number: string;
        customer_id: string;
        customer_phone: string;
        vendor_id: string;
        rider_name: string;
      }>(
        `SELECT da.id, da.order_id, da.delivery_boy_id, da.status,
                o.status as order_status, o.order_number, o.customer_id,
                cu.phone as customer_phone, o.vendor_id,
                u.first_name || ' ' || u.last_name as rider_name
         FROM delivery.delivery_assignments da
         JOIN order_management.orders o ON o.id = da.order_id
         JOIN identity.users cu ON cu.id = o.customer_id
         JOIN identity.users u ON u.id = da.delivery_boy_id
         WHERE da.id = $1 FOR UPDATE`,
        [assignmentId]
      );

      if (assignRes.rows.length === 0 || !assignRes.rows[0]) {
        throw new AppError('Delivery assignment not found.', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      const assign = assignRes.rows[0];

      if (assign.delivery_boy_id !== riderUserId) {
        throw new AppError('You are not authorized to update this assignment.', 403, 'FORBIDDEN');
      }

      if (assign.status !== 'ACCEPTED') {
        throw new AppError(
          `Cannot mark picked up in status "${assign.status}". Assignment must be in ACCEPTED state.`,
          400,
          'INVALID_ASSIGNMENT_STATUS'
        );
      }

      // Update assignment status to PICKED_UP
      await client.query(
        `UPDATE delivery.delivery_assignments 
         SET status = 'PICKED_UP', picked_up_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [assignmentId]
      );

      // Update order status to OUT_FOR_DELIVERY
      await client.query(
        `UPDATE order_management.orders 
         SET status = 'OUT_FOR_DELIVERY', delivery_status = 'PICKED_UP', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [assign.order_id]
      );

      // Record in status history
      await client.query(
        `INSERT INTO order_management.order_status_history (order_id, old_status, new_status, changed_by, reason)
         VALUES ($1, $2, 'OUT_FOR_DELIVERY', $3, 'Order picked up by rider for delivery')`,
        [assign.order_id, assign.order_status, riderUserId]
      );

      customerPhoneToSendOtp = assign.customer_phone;

      // Real-Time Socket Event
      SocketEvents.emitOrderOutForDelivery(assign.order_id, assign.customer_id, assign.vendor_id, {
        orderId: assign.order_id,
        orderNumber: assign.order_number,
        riderName: assign.rider_name,
      });

      return {
        assignmentId,
        status: 'PICKED_UP',
        orderStatus: 'OUT_FOR_DELIVERY',
        message: 'Order picked up. Delivery OTP generated and sent to customer.',
      };
    });

    // Send Delivery Confirmation OTP to customer's mobile number
    if (customerPhoneToSendOtp) {
      try {
        await AuthService.sendOtp(customerPhoneToSendOtp, 'DELIVERY_CONFIRMATION');
      } catch (err) {
        console.warn('Failed to send customer delivery confirmation OTP:', err);
      }
    }

    return result;
  }

  /**
   * 5. Delivery Completion — Path A: Delivery Boy submits Customer OTP
   * Atomically verifies OTP, completes delivery, and triggers single 90% vendor payout.
   */
  public static async completeDeliveryWithOtp(
    orderId: string,
    riderUserId: string,
    otpCode: string
  ): Promise<{ orderId: string; status: string; message: string }> {
    // 1. Fetch assignment and customer phone
    const orderRes = await query<{
      order_id: string;
      order_number: string;
      customer_id: string;
      customer_phone: string;
      vendor_id: string;
      status: string;
      delivery_status: string;
      assignment_id: string;
      assignment_status: string;
      delivery_boy_id: string;
    }>(
      `SELECT o.id as order_id, o.order_number, o.customer_id, u.phone as customer_phone,
              o.vendor_id, o.status, o.delivery_status,
              da.id as assignment_id, da.status as assignment_status, da.delivery_boy_id
       FROM order_management.orders o
       JOIN identity.users u ON u.id = o.customer_id
       LEFT JOIN delivery.delivery_assignments da ON da.order_id = o.id AND da.delivery_boy_id = $2
       WHERE o.id = $1`,
      [orderId, riderUserId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
      throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
    }

    const order = orderRes.rows[0];

    if (!order.assignment_id || order.delivery_boy_id !== riderUserId) {
      throw new AppError('You are not the assigned delivery partner for this order.', 403, 'FORBIDDEN');
    }

    if (order.status === 'DELIVERED') {
      return {
        orderId,
        status: 'DELIVERED',
        message: 'Order is already marked as DELIVERED.',
      };
    }

    if (order.assignment_status !== 'PICKED_UP' || order.status !== 'OUT_FOR_DELIVERY') {
      throw new AppError(
        `Cannot complete delivery. Order must be in OUT_FOR_DELIVERY state (current: ${order.status}).`,
        400,
        'INVALID_ORDER_STATE'
      );
    }

    // 2. Verify Delivery Confirmation OTP
    await AuthService.verifyOtp(order.customer_phone, otpCode, 'DELIVERY_CONFIRMATION');

    // 3. Atomically transition states and trigger 90% vendor payout
    await withTransaction(async (client) => {
      // Mark assignment DELIVERED
      await client.query(
        `UPDATE delivery.delivery_assignments 
         SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [order.assignment_id]
      );

      // Mark order DELIVERED
      await client.query(
        `UPDATE order_management.orders 
         SET status = 'DELIVERED', delivery_status = 'DELIVERED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [orderId]
      );

      // Status history
      await client.query(
        `INSERT INTO order_management.order_status_history (order_id, old_status, new_status, changed_by, reason)
         VALUES ($1, 'OUT_FOR_DELIVERY', 'DELIVERED', $2, 'Delivery completed via OTP verification by rider')`,
        [orderId, riderUserId]
      );

      // Reset rider duty status to ONLINE
      await client.query(
        `UPDATE delivery.delivery_profiles 
         SET status = 'ONLINE', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1`,
        [riderUserId]
      );
    });

    // 4. Trigger single 90% vendor payout idempotently
    try {
      await WalletService.creditVendorOnDelivery(orderId);
    } catch (payErr) {
      console.error(`Vendor delivery payout error for order ${orderId}:`, payErr);
    }

    // 5. Emit Socket Event & Send Notifications
    SocketEvents.emitOrderDelivered(orderId, order.customer_id, order.vendor_id, riderUserId, {
      orderId,
      orderNumber: order.order_number,
      completedAt: new Date(),
      verifiedVia: 'OTP',
    });

    return {
      orderId,
      status: 'DELIVERED',
      message: 'Delivery successfully verified via OTP. Order completed and vendor payout credited.',
    };
  }

  /**
   * 6. Delivery Completion — Path B: Customer Direct Confirmation
   * Allows customer to confirm delivery directly on their app.
   */
  public static async customerConfirmDelivery(
    orderId: string,
    customerUserId: string
  ): Promise<{ orderId: string; status: string; message: string }> {
    return await withTransaction(async (client) => {
      const orderRes = await client.query<{
        id: string;
        order_number: string;
        customer_id: string;
        vendor_id: string;
        status: string;
        delivery_status: string;
      }>(
        `SELECT id, order_number, customer_id, vendor_id, status, delivery_status 
         FROM order_management.orders 
         WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
        throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
      }

      const order = orderRes.rows[0];

      if (order.customer_id !== customerUserId) {
        throw new AppError('You can only confirm delivery for your own orders.', 403, 'FORBIDDEN');
      }

      if (order.status === 'DELIVERED') {
        return {
          orderId,
          status: 'DELIVERED',
          message: 'Order is already marked as DELIVERED.',
        };
      }

      if (order.status !== 'OUT_FOR_DELIVERY') {
        throw new AppError(
          `Cannot confirm delivery while order is in "${order.status}" status. Must be OUT_FOR_DELIVERY.`,
          400,
          'INVALID_ORDER_STATE'
        );
      }

      // Fetch active assignment if any
      const assignRes = await client.query<{ id: string; delivery_boy_id: string }>(
        `SELECT id, delivery_boy_id FROM delivery.delivery_assignments 
         WHERE order_id = $1 AND status IN ('ACCEPTED', 'PICKED_UP') 
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [orderId]
      );

      const activeAssignment = assignRes.rows[0];

      if (activeAssignment) {
        await client.query(
          `UPDATE delivery.delivery_assignments 
           SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [activeAssignment.id]
        );

        // Reset rider to ONLINE
        await client.query(
          `UPDATE delivery.delivery_profiles 
           SET status = 'ONLINE', updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1`,
          [activeAssignment.delivery_boy_id]
        );
      }

      // Update order to DELIVERED
      await client.query(
        `UPDATE order_management.orders 
         SET status = 'DELIVERED', delivery_status = 'DELIVERED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [orderId]
      );

      // Status history
      await client.query(
        `INSERT INTO order_management.order_status_history (order_id, old_status, new_status, changed_by, reason)
         VALUES ($1, 'OUT_FOR_DELIVERY', 'DELIVERED', $2, 'Confirmed directly by customer')`,
        [orderId, customerUserId]
      );

      // Trigger 90% vendor payout idempotently
      try {
        await WalletService.creditVendorOnDelivery(orderId);
      } catch (payErr) {
        console.error(`Vendor delivery payout error for order ${orderId}:`, payErr);
      }

      // Real-Time Socket Event
      SocketEvents.emitOrderDelivered(
        orderId,
        order.customer_id,
        order.vendor_id,
        activeAssignment?.delivery_boy_id || null,
        {
          orderId,
          orderNumber: order.order_number,
          completedAt: new Date(),
          verifiedVia: 'CUSTOMER_CONFIRMATION',
        }
      );

      return {
        orderId,
        status: 'DELIVERED',
        message: 'Delivery successfully confirmed by customer. Order completed.',
      };
    });
  }

  /**
   * 7. Rider reports Delivery Failure
   */
  public static async reportDeliveryFailure(
    assignmentId: string,
    riderUserId: string,
    reasonCode: string,
    notes?: string | null
  ): Promise<{ assignmentId: string; status: string; message: string }> {
    return await withTransaction(async (client) => {
      const assignRes = await client.query<{
        id: string;
        order_id: string;
        delivery_boy_id: string;
        status: string;
        order_status: string;
        order_number: string;
        customer_id: string;
        vendor_id: string;
        rider_name: string;
      }>(
        `SELECT da.id, da.order_id, da.delivery_boy_id, da.status,
                o.status as order_status, o.order_number, o.customer_id, o.vendor_id,
                u.first_name || ' ' || u.last_name as rider_name
         FROM delivery.delivery_assignments da
         JOIN order_management.orders o ON o.id = da.order_id
         JOIN identity.users u ON u.id = da.delivery_boy_id
         WHERE da.id = $1 FOR UPDATE`,
        [assignmentId]
      );

      if (assignRes.rows.length === 0 || !assignRes.rows[0]) {
        throw new AppError('Delivery assignment not found.', 404, 'ASSIGNMENT_NOT_FOUND');
      }

      const assign = assignRes.rows[0];

      if (assign.delivery_boy_id !== riderUserId) {
        throw new AppError('You are not authorized to update this assignment.', 403, 'FORBIDDEN');
      }

      if (!['ACCEPTED', 'PICKED_UP'].includes(assign.status)) {
        throw new AppError(
          `Cannot report failure in status "${assign.status}". Assignment must be active.`,
          400,
          'INVALID_ASSIGNMENT_STATUS'
        );
      }

      // Update assignment
      await client.query(
        `UPDATE delivery.delivery_assignments 
         SET status = 'CANCELLED', failure_reason = $1, failure_notes = $2, failed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [reasonCode, notes?.trim() || null, assignmentId]
      );

      // Update order to CANCELLED / FAILED
      await client.query(
        `UPDATE order_management.orders 
         SET status = 'CANCELLED', delivery_status = 'FAILED', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [assign.order_id]
      );

      // Status history
      await client.query(
        `INSERT INTO order_management.order_status_history (order_id, old_status, new_status, changed_by, reason)
         VALUES ($1, $2, 'CANCELLED', $3, $4)`,
        [
          assign.order_id,
          assign.order_status,
          riderUserId,
          `Delivery failed: ${reasonCode}${notes ? ` - ${notes}` : ''}`,
        ]
      );

      // Reset rider to ONLINE
      await client.query(
        `UPDATE delivery.delivery_profiles 
         SET status = 'ONLINE', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1`,
        [riderUserId]
      );

      // Socket Event
      SocketEvents.emitDeliveryFailed(assign.order_id, assign.customer_id, assign.vendor_id, {
        orderId: assign.order_id,
        orderNumber: assign.order_number,
        riderName: assign.rider_name,
        reasonCode,
        notes: notes || null,
      });

      return {
        assignmentId,
        status: 'FAILED',
        message: `Delivery failure recorded: ${reasonCode}. Vendor notified.`,
      };
    });
  }

  /**
   * 8. Rider GPS Location Beacon (Appends to append-only delivery_locations table)
   */
  public static async recordRiderLocation(
    riderUserId: string,
    latitude: number,
    longitude: number,
    accuracy?: number | null
  ): Promise<{ success: boolean; recordedAt: Date }> {
    // Find active assignment for this rider
    const activeRes = await query<{ id: string; order_id: string; customer_id: string }>(
      `SELECT da.id, da.order_id, o.customer_id
       FROM delivery.delivery_assignments da
       JOIN order_management.orders o ON o.id = da.order_id
       WHERE da.delivery_boy_id = $1 AND da.status IN ('ACCEPTED', 'PICKED_UP')
       ORDER BY da.created_at DESC
       LIMIT 1`,
      [riderUserId]
    );

    if (activeRes.rows.length === 0 || !activeRes.rows[0]) {
      throw new AppError(
        'No active delivery assignment in progress to attach GPS coordinate.',
        400,
        'NO_ACTIVE_DELIVERY'
      );
    }

    const assignment = activeRes.rows[0];

    const insertRes = await query<{ recorded_at: Date }>(
      `INSERT INTO delivery.delivery_locations (assignment_id, delivery_boy_id, latitude, longitude, accuracy)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING recorded_at`,
      [assignment.id, riderUserId, latitude, longitude, accuracy || null]
    );

    const recordedAt = insertRes.rows[0]!.recorded_at;

    // Real-Time GPS Emit to Customer
    SocketEvents.emitLocationUpdate(assignment.order_id, assignment.customer_id, {
      orderId: assignment.order_id,
      latitude,
      longitude,
      accuracy: accuracy || null,
      recordedAt,
    });

    return {
      success: true,
      recordedAt,
    };
  }

  /**
   * 9. Delivery Tracking: Real-time status & latest GPS location
   */
  public static async getOrderTracking(
    orderId: string,
    requesterUserId: string,
    requesterRoles: RoleCode[]
  ): Promise<TrackingResponse> {
    const orderRes = await query<{
      id: string;
      order_number: string;
      customer_id: string;
      vendor_id: string;
      status: string;
      delivery_status: string;
      owner_user_id: string;
    }>(
      `SELECT o.id, o.order_number, o.customer_id, o.vendor_id, o.status, o.delivery_status,
              v.owner_user_id
       FROM order_management.orders o
       JOIN vendor.vendors v ON v.id = o.vendor_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
      throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
    }

    const order = orderRes.rows[0];

    // Fetch latest assignment for this order
    const assignRes = await query<{
      id: string;
      delivery_boy_id: string;
      status: string;
      first_name: string;
      last_name: string;
      phone: string;
      vehicle_type: string;
      vehicle_number: string | null;
    }>(
      `SELECT da.id, da.delivery_boy_id, da.status,
              u.first_name, u.last_name, u.phone,
              COALESCE(dp.vehicle_type, 'BIKE') as vehicle_type,
              dp.vehicle_number
       FROM delivery.delivery_assignments da
       JOIN identity.users u ON u.id = da.delivery_boy_id
       LEFT JOIN delivery.delivery_profiles dp ON dp.user_id = u.id
       WHERE da.order_id = $1
       ORDER BY da.created_at DESC
       LIMIT 1`,
      [orderId]
    );

    const assign = assignRes.rows[0];

    const isCustomer = order.customer_id === requesterUserId;
    const isVendorOwner = order.owner_user_id === requesterUserId;
    const isAssignedRider = assign && assign.delivery_boy_id === requesterUserId;
    const isAdmin = requesterRoles.some((r) => [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(r as any));

    if (!isCustomer && !isVendorOwner && !isAssignedRider && !isAdmin) {
      throw new AppError('You do not have permission to track this order.', 403, 'FORBIDDEN');
    }

    // Fetch latest location
    let latestLocation: TrackingResponse['latestLocation'] = null;
    if (assign) {
      const locRes = await query<{
        latitude: string;
        longitude: string;
        accuracy: string | null;
        recorded_at: Date;
      }>(
        `SELECT latitude, longitude, accuracy, recorded_at
         FROM delivery.delivery_locations
         WHERE assignment_id = $1
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [assign.id]
      );

      if (locRes.rows.length > 0 && locRes.rows[0]) {
        latestLocation = {
          latitude: parseFloat(locRes.rows[0].latitude),
          longitude: parseFloat(locRes.rows[0].longitude),
          accuracy: locRes.rows[0].accuracy ? parseFloat(locRes.rows[0].accuracy) : null,
          recordedAt: locRes.rows[0].recorded_at,
        };
      }
    }

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: order.status,
      deliveryStatus: order.delivery_status,
      deliveryBoy: assign
        ? {
            id: assign.delivery_boy_id,
            firstName: assign.first_name,
            lastName: assign.last_name,
            phone: assign.phone,
            vehicleType: assign.vehicle_type,
            vehicleNumber: assign.vehicle_number,
          }
        : null,
      latestLocation,
    };
  }
}
