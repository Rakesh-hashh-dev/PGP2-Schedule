// A reminder is visible only for a student's enrolled subject and section.
export function feedbackFlashAudience(config, enrolled) {
  const code = config.subjectCode;
  return code && config.section && enrolled?.[code] === config.section ? code : null;
}
