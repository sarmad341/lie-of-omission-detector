const BASE_FIELDS = [
  { id: "first_name", section: "Policyholder Information", label: "First Name" },
  { id: "last_name", section: "Policyholder Information", label: "Last Name" },
  { id: "street_address", section: "Policyholder Information", label: "Street Address" },
  { id: "street_address_2", section: "Policyholder Information", label: "Street Address Line 2" },
  { id: "city", section: "Policyholder Information", label: "City" },
  { id: "state", section: "Policyholder Information", label: "State / Province" },
  { id: "postal_code", section: "Policyholder Information", label: "Postal / Zip Code" },
  { id: "phone", section: "Policyholder Information", label: "Phone Number", placeholder: "e.g. +1 555-0198" },
  { id: "email", section: "Policyholder Information", label: "Email", placeholder: "e.g. user@example.com" },
  { id: "date_of_birth", section: "Policyholder Information", label: "Date of Birth" },
  { id: "occupation", section: "Policyholder Information", label: "Occupation" },
  { id: "policy_inception_date", section: "Policyholder Information", label: "Policy Inception Date" },
  
  { id: "vehicle_make", section: "Vehicle Information", label: "Vehicle Make" },
  { id: "vehicle_model", section: "Vehicle Information", label: "Vehicle Model" },
  { id: "vehicle_year", section: "Vehicle Information", label: "Year of Manufacture" },
  { id: "vehicle_vin", section: "Vehicle Information", label: "Vehicle Identification Number (VIN)", placeholder: "e.g. 1HGCM82633A004XXX" },
  { id: "license_plate", section: "Vehicle Information", label: "License Plate Number", placeholder: "e.g. ABC-1234" },
  { id: "current_mileage", section: "Vehicle Information", label: "Current Mileage" },
];

export const LEGACY_TEMPLATE_FIELDS = [
  ...BASE_FIELDS,
  { id: "incident_date", section: "Incident Details", label: "Date of Incident" },
  { id: "incident_time", section: "Incident Details", label: "Time of Incident" },
  { id: "incident_location", section: "Incident Details", label: "Location of Incident", placeholder: "e.g. Main Boulevard, near the City Center intersection" },
  { id: "police_report_filed", section: "Incident Details", label: "Police Report Filed?", type: "dropdown", options: ["Yes", "No"] },
  { id: "police_report_number", section: "Incident Details", label: "Police Report Number", placeholder: "e.g. FIR-2026-00456" },
  { id: "incident_circumstances", section: "Vehicle Information", label: "Briefly describe the circumstances surrounding the incident" },

  { id: "injuries_description", section: "Injuries and Medical Treatment", label: "Description of Injuries (if any)" },
  { id: "medical_facilities_visited", section: "Injuries and Medical Treatment", label: "Medical Facilities Visited" },
  { id: "medical_expenses", section: "Injuries and Medical Treatment", label: "Expenses Incurred for Medical Treatment ($)" },

  { id: "damage_to_other_vehicle", section: "Damage Assessment", label: "Description of Damage to Other Vehicle(s)" },
  { id: "estimated_repair_cost", section: "Damage Assessment", label: "Estimated Cost of Repairs ($)" },
  { id: "additional_information", section: "Additional Information", label: "Anything else you'd like to add?" },
];

const COLLISION_FIELDS = [
  ...BASE_FIELDS,
  { id: "incident_date", section: "Incident Details", label: "Date of Incident" },
  { id: "incident_time", section: "Incident Details", label: "Time of Incident" },
  { id: "incident_location", section: "Incident Details", label: "Location of Incident", placeholder: "e.g. Main Boulevard, near the City Center intersection" },
  { id: "point_of_impact", section: "Incident Details", label: "Point of Impact", type: "dropdown", options: ["Front", "Rear", "Left", "Right", "Multiple"] },
  { id: "correct_side_of_road", section: "Incident Details", label: "Was the vehicle on its correct side of the road?", type: "dropdown", options: ["Yes", "No"] },
  { id: "estimated_speed", section: "Incident Details", label: "Estimated speed", placeholder: "e.g. 40 km/h" },
  { id: "incident_circumstances", section: "Incident Details", label: "Briefly describe the circumstances surrounding the incident" },
  { id: "police_report_filed", section: "Incident Details", label: "Police Report Filed?", type: "dropdown", options: ["Yes", "No"] },
  { id: "police_report_number", section: "Incident Details", label: "Police Report Number", placeholder: "e.g. FIR-2026-00456" },
  { id: "driven_or_towed", section: "Incident Details", label: "Was the vehicle driven or towed from the scene?", type: "dropdown", options: ["Driven", "Towed"] },
  
  { id: "driver_license_number", section: "Vehicle Information", label: "Driver's License Number" },
  { id: "driver_license_expiry", section: "Vehicle Information", label: "Driver's License Expiry Date" },
  { id: "driver_license_class", section: "Vehicle Information", label: "Driver's License Classification", type: "dropdown", options: ["Permanent", "Learner"] },

  { id: "damage_body_work", section: "Damage Assessment", label: "Damage to Body work" },
  { id: "damage_chassis", section: "Damage Assessment", label: "Damage to Chassis" },
  { id: "damage_accessories_lamps", section: "Damage Assessment", label: "Damage to Accessories & Lamps" },
  { id: "damage_tyres", section: "Damage Assessment", label: "Damage to Tyres" },

  { id: "witnesses", section: "Witnesses", label: "Witnesses", type: "table", columns: [
    { id: "name", label: "Name", placeholder: "e.g. John Doe" },
    { id: "address", label: "Address", placeholder: "e.g. 123 Main St" },
    { id: "position", label: "Position observed from", placeholder: "e.g. Sidewalk across street" }
  ]},

  { id: "injuries_description", section: "Injuries and Medical Treatment", label: "Description of Injuries (if any)" },
  { id: "medical_facilities_visited", section: "Injuries and Medical Treatment", label: "Medical Facilities Visited" },
  { id: "medical_expenses", section: "Injuries and Medical Treatment", label: "Expenses Incurred for Medical Treatment ($)" },

  { id: "damage_to_other_vehicle", section: "Additional Information", label: "Description of Damage to Other Vehicle(s)" },
  { id: "estimated_repair_cost", section: "Additional Information", label: "Estimated Cost of Repairs ($)" },
  { id: "additional_information", section: "Additional Information", label: "Anything else you'd like to add?" },
];

const THEFT_FIELDS = [
  ...BASE_FIELDS,
  { id: "theft_date", section: "Theft Details", label: "Date of Theft" },
  { id: "theft_time", section: "Theft Details", label: "Time of Theft" },
  { id: "date_reported", section: "Theft Details", label: "Date Reported to Insurer" },
  { id: "theft_location", section: "Theft Details", label: "Location of Theft", placeholder: "e.g. Main Boulevard, near the City Center intersection" },
  { id: "was_attended", section: "Theft Details", label: "Was the vehicle attended at the time?", type: "dropdown", options: ["Yes", "No"] },
  { id: "attended_by", section: "Theft Details", label: "If attended, by whom?" },
  { id: "time_parked_before_theft", section: "Theft Details", label: "How long had it been parked before the theft?" },
  { id: "witnesses", section: "Theft Details", label: "Witnesses", type: "table", columns: [
    { id: "name", label: "Name", placeholder: "e.g. John Doe" },
    { id: "address", label: "Address", placeholder: "e.g. 123 Main St" },
    { id: "position", label: "Position observed from", placeholder: "e.g. Sidewalk across street" }
  ]},
  { id: "police_station", section: "Theft Details", label: "Police Station" },
  { id: "police_report_number", section: "Theft Details", label: "Police Report Number", placeholder: "e.g. FIR-2026-00456" },
  { id: "later_recovered", section: "Theft Details", label: "Was the vehicle later recovered?", type: "dropdown", options: ["Yes", "No"] },

  { id: "stolen_articles", section: "Stolen Articles", label: "Itemized Stolen Articles", type: "table", columns: [
    { id: "date_of_purchase", label: "Date of Purchase", placeholder: "e.g. Jan 2024" },
    { id: "particulars", label: "Particulars", placeholder: "e.g. Laptop bag" },
    { id: "value", label: "Value ($)", placeholder: "e.g. 1500" },
    { id: "condition", label: "Condition", placeholder: "e.g. Used, good condition" }
  ]}
];

const DISASTER_FIELDS = [
  ...BASE_FIELDS,
  { id: "peril_type", section: "Incident Details", label: "Peril Type", type: "dropdown", options: ["Flood", "Hail", "Windstorm", "Earthquake", "Other"] },
  { id: "incident_date", section: "Incident Details", label: "Date of Incident" },
  { id: "incident_time", section: "Incident Details", label: "Time of Incident" },
  { id: "incident_location", section: "Incident Details", label: "Location of Incident", placeholder: "e.g. Main Boulevard, near the City Center intersection" },
  { id: "incident_circumstances", section: "Incident Details", label: "Briefly describe the damage circumstances" },
  
  { id: "damage_body_work", section: "Damage Assessment", label: "Damage to Body work" },
  { id: "damage_chassis", section: "Damage Assessment", label: "Damage to Chassis" },
  { id: "damage_accessories_lamps", section: "Damage Assessment", label: "Damage to Accessories & Lamps" },
  { id: "damage_tyres", section: "Damage Assessment", label: "Damage to Tyres" },
  { id: "estimated_repair_cost", section: "Damage Assessment", label: "Estimated Cost of Repairs ($)" },
  { id: "additional_information", section: "Damage Assessment", label: "Anything else you'd like to add?" },
];

export function getTemplateFields(category, subCategory) {
  if (category !== "Car Insurance" || !subCategory) {
    return LEGACY_TEMPLATE_FIELDS;
  }
  switch (subCategory) {
    case "collision": return COLLISION_FIELDS;
    case "theft": return THEFT_FIELDS;
    case "natural_disaster": return DISASTER_FIELDS;
    default: return LEGACY_TEMPLATE_FIELDS;
  }
}

export function getReviewSectionOrder(category, subCategory) {
  if (category !== "Car Insurance" || !subCategory) {
    return ["Policyholder Information", "Incident Details", "Vehicle Information", "Injuries and Medical Treatment", "Damage Assessment", "Additional Information"];
  }
  switch (subCategory) {
    case "collision": 
      return ["Policyholder Information", "Incident Details", "Vehicle Information", "Witnesses", "Damage Assessment", "Injuries and Medical Treatment", "Additional Information"];
    case "theft": 
      return ["Policyholder Information", "Theft Details", "Vehicle Information", "Stolen Articles"];
    case "natural_disaster": 
      return ["Policyholder Information", "Incident Details", "Vehicle Information", "Damage Assessment"];
    default: 
      return ["Policyholder Information", "Incident Details", "Vehicle Information", "Injuries and Medical Treatment", "Damage Assessment", "Additional Information"];
  }
}
