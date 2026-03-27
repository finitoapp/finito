const locale = {
	"form": {
		"fields": {
			"name": {
				"label": "Name"
			}
		}
	},
	"page": {
		"editDevice": "Edit device"
	},
	"table": {
		"columns": {
			"browser-name": "Browser",
			"created-at": "Created at",
			"device-type": "Device type",
			"device-vendor": "Vendor",
			"name": "Name",
			"os-name": "Operating system",
			"tables": "Tables"
		},
		"listOfYourDevices": "Overview of devices managed by this account. It helps track where data such as payments, invoices, and other records originate.",
		"devices": "Devices"
	},
	"detail": {
		"createdAt": "Created at",
		"modifiedAt": "Modified at",
		"sections": {
			"environment": "Environment",
			"environmentDescription": "Technical details captured from this device.",
			"metadata": "Metadata"
		},
		"fields": {
			"added": "Added",
			"createdAt": "Created at",
			"id": "ID",
			"name": "Name",
			"recordId": "Record ID",
			"tablesCount": "Assigned tables",
			"updated": "Last updated"
		},
		"actions": {
			"copyRecordId": "Copy record ID"
		},
		"empty": {
			"unknown": "Unknown"
		}
	}
} as const;

export default locale;
