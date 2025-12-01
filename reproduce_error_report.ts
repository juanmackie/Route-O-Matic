
import { parseCSV } from './lib/csv/parser';
import { generateErrorReport } from './lib/error-report-generator';

const csvContent = `app_name,address,visitdurationMinutes,startTime,date,flexibility
Good Appt,123 Main St,30,09:00,2024-01-01,flexible
Bad Duration,456 Elm St,invalid,10:00,2024-01-01,inflexible
Bad Time,789 Oak St,60,25:00,2024-01-01,flexible
Missing Date,321 Pine St,45,11:00,,flexible
`;

const result = parseCSV(csvContent);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);

const errorReport = generateErrorReport(result.errors, result.warnings, result.appointments);
console.log('Error Report CSV:');
console.log(errorReport);
