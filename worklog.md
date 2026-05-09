---
Task ID: 1
Agent: Main Agent
Task: Rebuild Flask app to Next.js, fix PDF export, redesign UI

Work Log:
- Cloned and analyzed original Flask app from GitHub
- Identified root cause of PDF failure: LibreOffice not available on Vercel
- Identified additional issues: session/file persistence, corrupted template.docx, missing form fields
- Converted entire app to Next.js 16 with TypeScript
- Replaced LibreOffice-based PDF generation with pdf-lib (pure JS, no system deps)
- Embedded DejaVu Sans font for Vietnamese character support
- Used @pdf-lib/fontkit for custom font embedding
- Created separate popup modals for K selection and file upload (moved out of settings)
- Created settings modal for template upload only
- Redesigned UI with shadcn/ui components, gradient header, card-based layout
- All file handling now client-side (no server storage needed) - works on Vercel
- Added toast notifications for user feedback
- PDF generation tested and working (818KB PDF with Vietnamese text)
- Lint passes with no errors

Stage Summary:
- PDF export now works on Vercel (using pdf-lib instead of LibreOffice)
- K selection and file upload are separate popups (not buried in settings)
- Missing form fields added (ngay_sinh_dd, gioi_tinh_dd)
- Professional UI with rose/pink theme matching original design
- All files saved to /home/z/my-project/
