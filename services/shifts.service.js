const Shift = require('../models/Shift');
const Workplace = require('../models/Workplace');
const User = require('../models/User');
const { resolveUserWorkplaceId } = require('./chat-room.service');

function createHttpError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
};

// Employee (or manager) posts one of their own shifts for cover — FR-15.
async function postShiftsService(shiftInput, userId, dependencies = {}) {
    if (!userId) {
        throw createHttpError('An authenticated user is required', 401);
    }

    const allowedFields = [
        'shift_date',
        'start_time',
        'end_time',
        'shift_role',
        'note'
    ];

    for (const field in shiftInput) {
        if (!allowedFields.includes(field)) {
            throw new Error(`Invalid create field: ${field}`);
        }
    }

    const ShiftModel = dependencies.ShiftModel || Shift;
    const UserModel = dependencies.UserModel || User;
    const resolveWorkplaceId = dependencies.resolveUserWorkplaceId || resolveUserWorkplaceId;

    const user = await UserModel.findById(userId);
    const workplaceId = user && await resolveWorkplaceId(user, dependencies);

    if (!workplaceId) {
        throw createHttpError('You must belong to an active workplace to post a shift.', 400);
    }

    const shiftObject = {
        workplace: workplaceId,
        posted_by: userId,
        shift_date: shiftInput.shift_date,
        start_time: shiftInput.start_time,
        end_time: shiftInput.end_time,
        shift_role: shiftInput.shift_role,
        note: shiftInput.note
    };

    return await ShiftModel.create(shiftObject);
}


// Employee withdraws a claim they made on a shift — FR-13's undo path.
async function withdrawShiftsService(shiftId, userId, dependencies = {}) {
    if (!userId) {
        throw createHttpError('An authenticated user is required', 401);
    }

    const ShiftModel = dependencies.ShiftModel || Shift;

    const shift = await ShiftModel.findOneAndUpdate(
        {
            _id: shiftId,
            claimed_by: userId,
            status: 'pending',
        },
        {
            claimed_by: null,
            status: 'open'
        },
        { new: true }
    );

    return shift;
}

async function getShiftsService(filter) {
    const shifts = await Shift.find(filter)
        .populate('posted_by', 'first_name last_name')
        .sort({ shift_date: 1, start_time: 1 });
    return shifts;
}

async function listPendingClaims(managerId, dependencies = {}) {
    if (!managerId) {
        throw createHttpError('An authenticated manager is required', 401);
    }

    const ShiftModel = dependencies.ShiftModel || Shift;
    const WorkplaceModel = dependencies.WorkplaceModel || Workplace;

    const workplace = await WorkplaceModel.findOne({
        manager_id: managerId,
        active: true,
    });

    if (!workplace) {
        return [];
    }

    return ShiftModel.find({
        workplace: workplace._id,
        status: 'pending',
        claimed_by: { $ne: null },
    })
        .populate('posted_by', 'first_name last_name email')
        .populate('claimed_by', 'first_name last_name email')
        .sort({ shift_date: 1, start_time: 1 })
        .lean();
}

async function claimShift(shiftId, employeeId, dependencies = {}) {
    if (!employeeId) {
        throw createHttpError('An authenticated employee is required', 401);
    }

    const ShiftModel = dependencies.ShiftModel || Shift;

    const shift = await ShiftModel.findOneAndUpdate(
        {
            _id: shiftId,
            status: 'open',
        },
        {
            claimed_by: employeeId,
            status: 'pending',
        },
        { new: true }
    );

    if (!shift) {
        throw createHttpError('Open shift not found.', 404);
    }

    return shift;
}

const VALID_CLAIM_ACTIONS = ['approve', 'reject'];

async function processShiftClaim(shiftId, managerId, action, dependencies = {}) {
    if (!managerId) {
        throw createHttpError('An authenticated manager is required', 401);
    }

    if (!VALID_CLAIM_ACTIONS.includes(action)) {
        throw createHttpError("Invalid action. Must be 'approve' or 'reject'.", 400);
    }

    const ShiftModel = dependencies.ShiftModel || Shift;
    const WorkplaceModel = dependencies.WorkplaceModel || Workplace;

    const workplace = await WorkplaceModel.findOne({
        manager_id: managerId,
        active: true,
    });

    if (!workplace) {
        throw createHttpError('Shift claim not found.', 404);
    }

    const shift = await ShiftModel.findOne({
        _id: shiftId,
        workplace: workplace._id,
        status: 'pending',
        claimed_by: { $ne: null },
    });

    if (!shift) {
        throw createHttpError('Shift claim not found.', 404);
    }

    if (action === 'approve') {
        shift.status = 'covered';
    } else {
        shift.status = 'open';
        shift.claimed_by = null;
    }

    await shift.save();
    return shift;
}


// FR-23: Employee withdraws their own posted shift.
// The shift is NOT deleted. It is marked as cancelled.
// Only open and unclaimed shifts can be withdrawn.
async function withdrawPostedShift(shiftId, userId) {
    if (!userId) {
        throw createHttpError('An authenticated user is required', 401);
    }

    const shift = await Shift.findById(shiftId);

    if (!shift) {
        throw createHttpError('Shift not found', 404);
    }

    if (shift.posted_by.toString() !== userId.toString()) {
        throw createHttpError(
            'You can only withdraw a shift that you posted',
            403
        );
    }

    if (shift.status !== 'open' || shift.claimed_by) {
        throw createHttpError(
            'Only open and unclaimed shifts can be withdrawn',
            409
        );
    }

    shift.status = 'cancelled';
    await shift.save();

    return shift;
}


module.exports = {
    getShiftsService,
    listPendingClaims,
    postShiftsService,
    withdrawShiftsService,
    claimShift,
    processShiftClaim,
    withdrawPostedShift,
};