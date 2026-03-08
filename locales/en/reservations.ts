const locale = {
	"page": {
		"calendar": {
			"title": "Reservation Calendar",
			"description": "Manage reservations per table in a day view.",
			"tableColumn": "Table",
			"zoomHorizontal": "H zoom {{percent}}%",
			"zoomVertical": "V zoom {{percent}}%",
			"seatsFilter": "Min seats",
			"seatsMin": "e.g. 6",
			"collisionWarning": "Overlapping reservations on the same table were detected ({{count}}).",
			"collisionAction": "Go to collision",
			"capacityWarning": "Reservations exceeding table capacity were detected ({{count}}).",
			"capacityAction": "Go to issue",
			"approvedWithoutTableWarning": "Future approved reservations without an assigned table were detected ({{count}}).",
			"approvedWithoutTableAction": "Edit reservation",
			"noTablesWarning": "No tables exist yet. Create a table first to use the timeline.",
			"selectedTimezone": "Timezone: {{timezone}}",
			"unassigned": {
				"title": "Unassigned reservations",
				"empty": "No unassigned reservations for this day."
			}
		},
		"operations": {
			"title": "Operations",
			"pendingTitle": "Pending approval",
			"pendingEmpty": "No pending reservations in the future.",
			"invalidTitle": "Invalid reservations (approved without table)",
			"nearestTitle": "Nearest reservations",
			"nearestEmpty": "No nearby reservations.",
			"seatedTitle": "Seated reservations",
			"seatedEmpty": "No seated reservations."
		},
		"details": {
			"title": "Reservation detail",
			"back": "Back to operations",
			"time": "Time",
			"quickActions": "Quick actions",
			"notFound": "Selected reservation no longer exists."
		},
		"actions": {
			"newReservation": "New reservation",
			"addTable": "Add table",
			"newUnassignedReservation": "New unassigned",
			"moveReservation": "Move",
			"resizeReservation": "Resize",
			"approveReservation": "Approve",
			"rejectReservation": "Reject",
			"assignTable": "Assign table",
			"markSeated": "Mark seated",
			"markCompleted": "Mark completed",
			"markNoShow": "Mark no-show",
			"edit": "Edit",
			"previousDay": "Previous day",
			"nextDay": "Next day",
			"pickDay": "Pick day"
		},
		"form": {
			"newTitle": "New reservation",
			"editTitle": "Edit reservation"
		},
		"delete": {
			"title": "Delete reservation?",
			"description": "This action cannot be undone.",
			"confirm": "Delete",
			"cancel": "Cancel"
		},
		"dragConfirm": {
			"title": "Save reservation move?",
			"description": "The reservation will be moved to the new position.",
			"timeChange": "Time: {{from}} -> {{to}}",
			"tableChange": "Table: {{from}} -> {{to}}",
			"confirm": "Save",
			"cancel": "Cancel"
		}
	},
	"form": {
		"fields": {
			"id": "ID",
			"_tag": "Type",
			"name": "Name",
			"phone": "Phone",
			"email": "Email",
			"label": "Block label",
			"note": "Note",
			"numberOfPeople": "Party size",
			"approvalStatus": "Approval status",
			"serviceStatus": "Visit status",
			"statusReason": "Status reason",
			"source": "Source",
			"tableId": "Table",
			"startAtLocal": "Start",
			"durationMinutes": "Duration (min)"
		},
		"approval": {
			"pending": "Pending",
			"approved": "Approved",
			"rejected": "Rejected"
		},
		"service": {
			"upcoming": "Upcoming",
			"seated": "Seated",
			"completed": "Completed",
			"noShow": "No-show"
		},
		"source": {
			"manual": "Manual",
			"phone": "Phone",
			"web": "Web"
		},
		"tag": {
			"reservationBooking": "Reservation",
			"reservationBlock": "Block"
		},
		"table": {
			"unassigned": "Unassigned"
		}
	}
} as const;

export default locale;
