## Sprint 5: Planned Features and Schema Changes

This section describes the planned scope for Sprint 5.

### Planned Features

1. **Add backend tests** to ensure no regressions occur.
2. **Verify email on volunteer signup**: Require valid email addresses for new volunteer accounts.
3. **Improve calendar component**: Use throughout the app; support disabling dates, showing details under dates, selecting ranges, and picking separate dates. (This will support later features.)
4. **Update posting page**: Show (full/not full) and (number of volunteers/max) separately from the status card.
5. **Allow full/partial commitment for postings**: Organizations can specify, for each posting, whether volunteers must attend all days ("full commitment") or may select specific days to attend ("partial commitment"). This is configured using the calendar component, where organizations pick the opportunity days and set the commitment type. Volunteers applying to a posting with partial commitment can choose which of the available days they will attend; with full commitment, they must commit to all days.
6. **Volunteers can report organizations**: From the organization profile view, volunteers can submit a report with a message and select a report type. The report type is stored in the `title` field (e.g., "scam", "impersonation").
7. **Organizations can report volunteers**: From the volunteer profile view, organizations can submit a report with a message and select a report type. The report type is stored in the `title` field (e.g., "scam", "impersonation").
8. **Admin reports page**: Add a reports page to the admin homepage, with separate lists for organization and volunteer reports, and filtering. Include a disable account button.
9. **Admin can disable user accounts**: Backend and DB support for disabling accounts.
10. **Volunteer profile page (org view)**: Create a volunteer profile page accessible to organizations.
11. **Improve volunteer collapse component**: Add link to volunteer profile and direct CV download for organizations viewing attendees.
12. **Volunteers can search for organizations**: Add organization search to the volunteer search page.
13. **Extract Card component** for reuse.
14. **SMTP improvements**: Ensure email delivery works and format emails.
15. **Remove privacy feature from volunteer profile**: No more public/private toggle for volunteer profiles.
16. **Certificate verification**: Allow outside users to verify volunteer certificates.
17. **Homepage/guide improvements**: Add more info and a detailed guide page for users.
18. **Account deletion**: Allow users to delete their account and update all related queries.
19. **Fix birth date bug**: Prevent birth date from decreasing by 1 day on each profile save.
20. **Recommendation system QA**: Ensure the recommendation system works correctly.
21. **Google Maps link**: Add a link to Google Maps for locations.

### Planned Database Schema Changes

1. **volunteer_account**: Remove privacy settings. Add `is_disabled` (boolean) and `is_deleted` (boolean) fields.
2. **organization_account**: Add `is_disabled` (boolean) and `is_deleted` (boolean) fields.
3. **volunteer_pending_account** (new table):
   - id (serial, PK)
   - first_name (varchar(64))
   - last_name (varchar(64))
   - password (varchar(256))
   - email (varchar(128))
   - gender (varchar(64))
   - date_of_birth (date)
   - created_at (timestamp)
   - token (varchar)
4. **posting**: Make end date & time required. Add `allows_partial_attendance` (boolean).
5. **organization_report** (new table):
   - id (serial, PK)
   - reported_organization_id (int, FK)
   - reporter_volunteer_id (int, FK)
   - title (varchar(128))
   - message (text)
   - created_at (timestamp)
6. **volunteer_report** (new table):
   - id (serial, PK)
   - reported_volunteer_id (int, FK)
   - reporter_organization_id (int, FK)
   - title (varchar(128))
   - message (text)
   - created_at (timestamp)
7. **enrollment_application_date** (new table):
   - id (serial, PK)
   - application_id (int, FK)
   - date (date)

**Note:** This section is a living reference for Sprint 5. Check the codebase or project board for the current status of each item.
