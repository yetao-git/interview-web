import { STAGES, INTERVIEW_TYPES, INTERVIEW_FEEDBACKS } from './constants.js';

export function normalizeInterviewTimeValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  const persisted = str.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):\d{2}$/);
  if (persisted) return `${persisted[1]} ${persisted[2]}:${persisted[3]}:00`;
  const local = str.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  if (local) return `${local[1]} ${local[2]}:${local[3]}:00`;
  return str;
}

export function formatDateTimeValue(value) {
  return normalizeInterviewTimeValue(value);
}

export function toDateTimeLocalValue(value) {
  if (!value) return '';
  return normalizeInterviewTimeValue(value).slice(0, 16).replace(' ', 'T');
}

export function formatInterviewTimeDisplayValue(value) {
  if (!value) return '';
  return normalizeInterviewTimeValue(value).slice(0, 16);
}

function normalizeStageValue(value) {
  const map = { '待1面': '1 面', '待2面': '2 面', '待3面': '3 面', '待HR面': 'HR 面' };
  return map[value] || (STAGES.includes(value) ? value : STAGES[0]);
}

function normalizeInterviewFeedbackValue(value) {
  if (value === '待推进') return '推进中';
  return INTERVIEW_FEEDBACKS.includes(value) ? value : INTERVIEW_FEEDBACKS[0];
}

export function normalizeInterviewRow(row) {
  const normalized = {
    id: row?.id || '', companyName: row?.companyName || '',
    interviewTime: normalizeInterviewTimeValue(row?.interviewTime),
    interviewType: INTERVIEW_TYPES.includes(row?.interviewType) ? row.interviewType : INTERVIEW_TYPES[0],
    stage: normalizeStageValue(row?.stage),
    salaryRange: row?.salaryRange || '', positionTitle: row?.positionTitle || '',
    location: row?.location || '', notes: row?.notes || ''
  };
  normalized.interviewFeedback = normalizeInterviewFeedbackValue(row?.interviewFeedback);
  return normalized;
}
