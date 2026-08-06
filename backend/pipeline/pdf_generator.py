"""
Generates a filled-in PDF version of the claim form template — mirrors
the exact layout of the standard Car Insurance Claim Form with boxed input
fields, sub-labels, side-by-side columns, and clean structure. Pure local
generation via reportlab — no external service.
"""
from io import BytesIO
from datetime import date
import re

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)

# Colors matching standard form design
COLOR_TITLE = colors.HexColor("#2C3E50")
COLOR_HEADER = colors.HexColor("#2C3E50")
COLOR_LABEL = colors.HexColor("#1A202C")
COLOR_SUBTEXT = colors.HexColor("#718096")
COLOR_BORDER = colors.HexColor("#2D3748")
COLOR_TEXT = colors.HexColor("#1A202C")

PAGE_WIDTH = 540  # Printable width for letter size with 0.5 margin


def _val(template_data: dict, key: str, default: str = "") -> str:
    v = (template_data or {}).get(key)
    return str(v).strip() if v else default


def parse_date_parts(date_str: str):
    if not date_str:
        return "", "", ""
    parts = re.split(r"[-/\s.]+", str(date_str).strip())
    if len(parts) == 3:
        if len(parts[0]) == 4:  # YYYY-MM-DD
            return parts[1], parts[2], parts[0]
        else:  # MM-DD-YYYY
            return parts[0], parts[1], parts[2]
    return date_str, "", ""


def parse_time_parts(time_str: str):
    if not time_str:
        return "", ""
    parts = re.split(r"[:\s]+", str(time_str).strip())
    if len(parts) >= 2:
        return parts[0], parts[1]
    return time_str, ""


def generate_claim_form_pdf(template_data: dict, claims: list, category: str) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    style_title = ParagraphStyle(
        "FormTitle",
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=COLOR_TITLE,
        spaceAfter=14,
    )
    style_section = ParagraphStyle(
        "FormSection",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=COLOR_HEADER,
        spaceBefore=14,
        spaceAfter=10,
    )
    style_field_label = ParagraphStyle(
        "FieldLabel",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=COLOR_LABEL,
        spaceAfter=4,
    )
    style_sub_label = ParagraphStyle(
        "SubLabel",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=COLOR_SUBTEXT,
        spaceBefore=2,
    )
    style_field_val = ParagraphStyle(
        "FieldValue",
        fontName="Helvetica",
        fontSize=9.5,
        leading=12,
        textColor=COLOR_TEXT,
    )
    style_declaration_title = ParagraphStyle(
        "DecTitle",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        alignment=1,  # Center
        textColor=COLOR_TITLE,
        spaceAfter=4,
    )
    style_declaration_body = ParagraphStyle(
        "DecBody",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        alignment=1,  # Center
        textColor=COLOR_TEXT,
        spaceAfter=12,
    )

    story = []

    sub_type = template_data.get("type", "")
    if sub_type == "collision":
        cat_label = "Collision Motor"
    elif sub_type == "theft":
        cat_label = "Theft Motor"
    elif sub_type == "natural_disaster":
        cat_label = "Natural Disaster Motor"
    else:
        cat_label = category.replace("_", " ").title() if category else "Car Insurance"

    form_title = f"{cat_label} Claim Form" if "Claim" not in cat_label else cat_label
    if not form_title.endswith(" Form"):
        form_title += " Form"

    story.append(Paragraph(form_title, style_title))

    # Helper: Create a single boxed input cell table
    def make_box(text: str, width=None, min_height=20, is_multiline=False):
        p = Paragraph(text if text else "&nbsp;", style_field_val)
        col_widths = [width] if width else [PAGE_WIDTH]
        t = Table([[p]], colWidths=col_widths)
        pad = 6 if is_multiline else 4
        t.setStyle(
            TableStyle([
                ("BOX", (0, 0), (-1, -1), 1, COLOR_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP" if is_multiline else "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), pad),
                ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ])
        )
        return t

    # Helper: Create field with title + box + sub-label
    def create_field_block(label: str, value: str, sublabel: str = "", width=PAGE_WIDTH, is_multiline=False):
        elems = []
        if label:
            elems.append(Paragraph(label, style_field_label))
        elems.append(make_box(value, width=width, is_multiline=is_multiline))
        if sublabel:
            elems.append(Paragraph(sublabel, style_sub_label))
        elems.append(Spacer(1, 8))
        return elems

    # Helper: Date 3-box group
    def create_date_block(label: str, date_str: str):
        elems = []
        if label:
            elems.append(Paragraph(label, style_field_label))
        m, d, y = parse_date_parts(date_str)
        t_m = make_box(m, width=50)
        t_d = make_box(d, width=50)
        t_y = make_box(y, width=70)
        p_m = Paragraph("Month", style_sub_label)
        p_d = Paragraph("Day", style_sub_label)
        p_y = Paragraph("Year", style_sub_label)

        grid = Table(
            [[t_m, t_d, t_y], [p_m, p_d, p_y]],
            colWidths=[54, 54, 74],
        )
        grid.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        elems.append(grid)
        elems.append(Spacer(1, 8))
        return elems

    # Helper: Date & Time group
    def create_datetime_block(label: str, date_str: str, time_str: str):
        elems = []
        if label:
            elems.append(Paragraph(label, style_field_label))
        m, d, y = parse_date_parts(date_str)
        hr, mn = parse_time_parts(time_str)

        t_m = make_box(m, width=46)
        t_d = make_box(d, width=46)
        t_y = make_box(y, width=64)
        t_hr = make_box(hr, width=46)
        t_mn = make_box(mn, width=46)

        p_m = Paragraph("Month", style_sub_label)
        p_d = Paragraph("Day", style_sub_label)
        p_y = Paragraph("Year", style_sub_label)
        p_hr = Paragraph("Hour", style_sub_label)
        p_mn = Paragraph("Minutes", style_sub_label)

        grid = Table(
            [[t_m, t_d, t_y, t_hr, t_mn], [p_m, p_d, p_y, p_hr, p_mn]],
            colWidths=[50, 50, 68, 50, 50],
        )
        grid.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        elems.append(grid)
        elems.append(Spacer(1, 8))
        return elems

    # ---------------------------------------------------------
    # 1. Policyholder Information
    # ---------------------------------------------------------
    story.append(Paragraph("Policyholder Information", style_section))

    # Name (2 columns)
    story.append(Paragraph("Name", style_field_label))
    fn_box = make_box(_val(template_data, "first_name"), width=260)
    ln_box = make_box(_val(template_data, "last_name"), width=260)
    fn_sub = Paragraph("First Name", style_sub_label)
    ln_sub = Paragraph("Last Name", style_sub_label)
    name_table = Table(
        [[fn_box, ln_box], [fn_sub, ln_sub]], colWidths=[270, 270]
    )
    name_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(name_table)
    story.append(Spacer(1, 8))

    # Address (Street 1, Street 2, City + State, Zip)
    story.append(Paragraph("Address", style_field_label))
    story.append(make_box(_val(template_data, "street_address"), width=PAGE_WIDTH))
    story.append(Paragraph("Street Address", style_sub_label))
    story.append(Spacer(1, 4))

    story.append(make_box(_val(template_data, "street_address_2"), width=PAGE_WIDTH))
    story.append(Paragraph("Street Address Line 2", style_sub_label))
    story.append(Spacer(1, 4))

    city_box = make_box(_val(template_data, "city"), width=260)
    state_box = make_box(_val(template_data, "state"), width=260)
    city_sub = Paragraph("City", style_sub_label)
    state_sub = Paragraph("State / Province", style_sub_label)
    city_state_table = Table(
        [[city_box, state_box], [city_sub, state_sub]], colWidths=[270, 270]
    )
    city_state_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(city_state_table)
    story.append(Spacer(1, 4))

    story.append(make_box(_val(template_data, "postal_code"), width=260))
    story.append(Paragraph("Postal / Zip Code", style_sub_label))
    story.append(Spacer(1, 10))

    # Phone, Email, DOB, Occupation
    story.extend(
        create_field_block(
            "Phone Number",
            _val(template_data, "phone"),
            sublabel="Please enter a valid phone number.",
            width=260,
        )
    )
    story.extend(
        create_field_block(
            "Email",
            _val(template_data, "email"),
            sublabel="example@example.com",
            width=PAGE_WIDTH,
        )
    )
    story.extend(
        create_date_block(
            "Date of Birth", _val(template_data, "date_of_birth")
        )
    )
    story.extend(
        create_field_block(
            "Occupation", _val(template_data, "occupation"), width=PAGE_WIDTH
        )
    )
    story.extend(
        create_date_block(
            "Policy Inception Date", _val(template_data, "policy_inception_date")
        )
    )

    # ---------------------------------------------------------
    # 2. Incident Details
    # ---------------------------------------------------------
    story.append(Paragraph("Incident Details", style_section))
    story.extend(
        create_datetime_block(
            "Date & Time of Incident",
            _val(template_data, "incident_date"),
            _val(template_data, "incident_time"),
        )
    )
    story.extend(
        create_field_block(
            "Location of Incident",
            _val(template_data, "incident_location"),
            width=PAGE_WIDTH,
            is_multiline=True,
        )
    )

    if sub_type == "natural_disaster" and _val(template_data, "peril_type"):
        story.extend(create_field_block("Peril Type", _val(template_data, "peril_type"), width=260))

    if sub_type == "theft":
        story.extend(create_datetime_block("Date & Time of Theft", _val(template_data, "theft_date"), _val(template_data, "theft_time")))
        story.extend(create_field_block("Location of Theft", _val(template_data, "theft_location"), width=PAGE_WIDTH, is_multiline=True))
        story.extend(create_field_block("Was the vehicle attended at the time?", _val(template_data, "was_attended"), width=260))
        if _val(template_data, "attended_by"):
            story.extend(create_field_block("If attended, by whom?", _val(template_data, "attended_by"), width=PAGE_WIDTH))
        story.extend(create_field_block("How long had it been parked before the theft?", _val(template_data, "time_parked_before_theft"), width=PAGE_WIDTH))
        story.extend(create_field_block("Police Station", _val(template_data, "police_station"), width=PAGE_WIDTH))
        story.extend(create_field_block("Was the vehicle later recovered?", _val(template_data, "later_recovered"), width=260))
        if _val(template_data, "date_reported"):
            story.extend(create_date_block("Date Reported to Insurer", _val(template_data, "date_reported")))
    else:
        if _val(template_data, "point_of_impact"):
            story.extend(create_field_block("Point of Impact", _val(template_data, "point_of_impact"), width=260))
        if _val(template_data, "correct_side_of_road"):
            story.extend(create_field_block("Was the vehicle on its correct side of the road?", _val(template_data, "correct_side_of_road"), width=260))
        if _val(template_data, "estimated_speed"):
            story.extend(create_field_block("Estimated Speed", _val(template_data, "estimated_speed"), width=260))
        if _val(template_data, "driven_or_towed"):
            story.extend(create_field_block("Was the vehicle driven or towed from the scene?", _val(template_data, "driven_or_towed"), width=260))

    # Police Report Filed Radio
    story.append(Paragraph("Police Report Filed", style_field_label))
    police_val = _val(template_data, "police_report_filed").lower()
    is_yes = police_val in ["yes", "true", "y"]
    is_no = police_val in ["no", "false", "n"]
    radio_yes_str = "● Yes" if is_yes else "○ Yes"
    radio_no_str = "● No" if is_no else "○ No"
    radio_p = Paragraph(f"{radio_yes_str}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{radio_no_str}", style_field_val)
    story.append(radio_p)
    story.append(Spacer(1, 8))

    story.extend(
        create_field_block(
            "Police Report Number",
            _val(template_data, "police_report_number"),
            width=PAGE_WIDTH,
        )
    )

    # ---------------------------------------------------------
    # 3. Vehicle Information
    # ---------------------------------------------------------
    story.append(Paragraph("Vehicle Information", style_section))
    make_box_elem = make_box(_val(template_data, "vehicle_make"), width=260)
    model_box_elem = make_box(_val(template_data, "vehicle_model"), width=260)
    make_sub = Paragraph("Vehicle Make", style_sub_label)
    model_sub = Paragraph("Vehicle Model", style_sub_label)
    make_model_table = Table(
        [[make_box_elem, model_box_elem], [make_sub, model_sub]], colWidths=[270, 270]
    )
    make_model_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(make_model_table)
    story.append(Spacer(1, 4))
    story.extend(
        create_field_block(
            "Year of Manufacture", _val(template_data, "vehicle_year"), width=160
        )
    )
    story.extend(
        create_field_block(
            "Vehicle Identification Number (VIN)", _val(template_data, "vehicle_vin"), width=PAGE_WIDTH
        )
    )
    story.extend(
        create_field_block(
            "License Plate Number", _val(template_data, "license_plate"), width=PAGE_WIDTH
        )
    )
    story.extend(
        create_field_block(
            "Current Mileage", _val(template_data, "current_mileage"), width=PAGE_WIDTH
        )
    )
    story.extend(
        create_field_block(
            "Briefly describe the circumstances surrounding the incident, including the events leading up to it.",
            _val(template_data, "incident_circumstances"),
            width=PAGE_WIDTH,
            is_multiline=True,
        )
    )

    # ---------------------------------------------------------
    # Witnesses
    # ---------------------------------------------------------
    if sub_type == "collision" or sub_type == "theft":
        story.append(Paragraph("Witnesses", style_section))
        witnesses = template_data.get("witnesses") or []
        if not witnesses or witnesses == "Not provided":
            story.extend(create_field_block("", "No witnesses provided", width=PAGE_WIDTH))
        elif isinstance(witnesses, str):
            story.extend(create_field_block("Witnesses", witnesses, width=PAGE_WIDTH, is_multiline=True))
        else:
            for i, w in enumerate(witnesses):
                if isinstance(w, str):
                    w_text = f"Name: {w}<br/>Address: <br/>Position: "
                else:
                    w_text = f"Name: {w.get('name', '')}<br/>Address: {w.get('address', '')}<br/>Position: {w.get('position', '')}"
                story.extend(create_field_block(f"Witness {i+1}", w_text, width=PAGE_WIDTH, is_multiline=True))

    # ---------------------------------------------------------
    # 4. Injuries and Medical Treatment
    # ---------------------------------------------------------
    story.append(Paragraph("Injuries and Medical Treatment", style_section))
    story.extend(
        create_field_block(
            "Description of Injuries (if any)",
            _val(template_data, "injuries_description"),
            width=PAGE_WIDTH,
            is_multiline=True,
        )
    )
    story.extend(
        create_field_block(
            "Medical Facilities Visited",
            _val(template_data, "medical_facilities_visited"),
            width=PAGE_WIDTH,
            is_multiline=True,
        )
    )
    story.extend(
        create_field_block(
            "Expenses Incurred for Medical Treatment $",
            _val(template_data, "medical_expenses"),
            width=160,
        )
    )

    # ---------------------------------------------------------
    # 5. Damage Assessment / Stolen Articles
    # ---------------------------------------------------------
    if sub_type == "theft":
        story.append(Paragraph("Itemized Stolen Articles", style_section))
        articles = template_data.get("stolen_articles") or []
        if not articles or articles == "Not provided":
            story.extend(create_field_block("", "No stolen articles listed.", width=PAGE_WIDTH))
        elif isinstance(articles, str):
            story.extend(create_field_block("Itemized Stolen Articles", articles, width=PAGE_WIDTH, is_multiline=True))
        else:
            for i, a in enumerate(articles):
                if isinstance(a, str):
                    a_text = f"Particulars: {a}<br/>Value: $<br/>Condition: "
                else:
                    a_text = f"Purchase Date: {a.get('date_of_purchase', '')}<br/>Particulars: {a.get('particulars', '')}<br/>Value: ${a.get('value', '')}<br/>Condition: {a.get('condition', '')}"
                story.extend(create_field_block(f"Item {i+1}", a_text, width=PAGE_WIDTH, is_multiline=True))
    else:
        story.append(Paragraph("Damage Assessment", style_section))

        if sub_type == "collision":
            groups = ["Body work", "Chassis", "Accessories & Lamps", "Tyres"]
            for group in groups:
                group_lines = []
                for c in (claims or []):
                    cat = c.get("component_category", "") if isinstance(c, dict) else ""
                    if cat == group or (not cat and group == "Body work"):
                        txt = c.get("claim_text", "") if isinstance(c, dict) else str(c)
                        if txt:
                            group_lines.append(f"• {txt}")
                group_full = "<br/>".join(group_lines) if group_lines else _val(template_data, f"damage_{group.lower().replace(' ', '_').replace('&_', '')}")
                story.extend(
                    create_field_block(
                        f"Damage to {group}",
                        group_full,
                        width=PAGE_WIDTH,
                        is_multiline=True,
                    )
                )
        else:
            damage_text_lines = []
            if claims:
                for c in claims:
                    txt = c.get("claim_text", "") if isinstance(c, dict) else str(c)
                    if txt:
                        damage_text_lines.append(f"• {txt}")
            damage_full_text = "<br/>".join(damage_text_lines) if damage_text_lines else _val(template_data, "description_of_damage")

            story.extend(
                create_field_block(
                    "Description of Damage to Your Vehicle",
                    damage_full_text,
                    width=PAGE_WIDTH,
                    is_multiline=True,
                )
            )
        story.extend(
            create_field_block(
                "Description of Damage to Other Vehicle(s)",
                _val(template_data, "damage_to_other_vehicle"),
                width=PAGE_WIDTH,
                is_multiline=True,
            )
        )
        story.extend(
            create_field_block(
                "Estimated Cost of Repairs $",
                _val(template_data, "estimated_repair_cost"),
                width=160,
            )
        )

    # ---------------------------------------------------------
    # 6. Additional Information & Declaration
    # ---------------------------------------------------------
    story.append(Paragraph("Additional Information", style_section))
    story.extend(
        create_field_block(
            "Anything else you'd like to add?",
            _val(template_data, "additional_information"),
            width=PAGE_WIDTH,
            is_multiline=True,
        )
    )

    # ---------------------------------------------------------
    # For Insurer Use Only
    # ---------------------------------------------------------
    story.append(Spacer(1, 20))
    story.append(Paragraph("For Insurer Use Only: External Verification", style_section))
    if sub_type == "natural_disaster":
        story.extend(create_field_block("Tier 4: Weather Data Verification", "[  ] Confirmed      [  ] Unverified      [  ] Pending Lookup", width=PAGE_WIDTH))
    elif sub_type == "theft":
        story.extend(create_field_block("Tier 1: Police Database Verification", "[  ] Confirmed      [  ] Unverified      [  ] Pending Lookup", width=PAGE_WIDTH))
    else:
        story.extend(create_field_block("Tier Verification Results", "Pending submission to rules engine.", width=PAGE_WIDTH, is_multiline=True))

    story.append(Spacer(1, 14))

    # Declaration block
    dec_block = []
    dec_block.append(Paragraph("Declaration:", style_declaration_title))
    dec_block.append(
        Paragraph(
            "I declare that the information provided is true and accurate to the best of my knowledge. "
            "I understand that providing false information may result in the denial of my claim.",
            style_declaration_body,
        )
    )
    dec_block.extend(
        create_date_block(
            "Date", date.today().strftime("%m/%d/%Y")
        )
    )

    story.append(KeepTogether(dec_block))

    doc.build(story)
    return buffer.getvalue()

