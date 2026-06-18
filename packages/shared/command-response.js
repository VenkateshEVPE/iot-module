/**
 * Helpers for Concox online-command (0x21 / 0x15) response text.
 */

/**
 * @param {string} responseText
 * @returns {'success'|'failure'|'deferred'|'unknown'}
 */
export function classifyCommandResponse(responseText) {
  const upper = String(responseText || '').toUpperCase();

  if (
    upper.includes('ERROR') ||
    upper.includes('FAIL') ||
    upper.includes('INVALID')
  ) {
    return 'failure';
  }

  if (
    upper.includes('DELAY EXECUTION') ||
    (upper.includes('GPS NOT FIXED') && upper.includes('DELAY'))
  ) {
    return 'deferred';
  }

  if (
    upper.includes('OK') ||
    upper.includes('SUCCESS') ||
    upper.includes('RELAY')
  ) {
    return 'success';
  }

  return 'unknown';
}

export function isRelayImmobilizeCommand(command) {
  return String(command || '').trim().toUpperCase() === 'RELAY,1#';
}

export function isRelayMobilizeCommand(command) {
  return String(command || '').trim().toUpperCase() === 'RELAY,0#';
}

export function isRelayCommand(command) {
  return isRelayImmobilizeCommand(command) || isRelayMobilizeCommand(command);
}

export function expectedImmobilizedForRelayCommand(command) {
  return isRelayImmobilizeCommand(command);
}
