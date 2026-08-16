export function companionSafeFontPercent(text, requestedSize = 'auto') {
  const requested = requestedSize === 'auto' ? 100 : Math.max(1, Number(requestedSize) || 100);
  const longestWord = String(text || 'BUTTON').split(/\s+/).reduce((longest, word) => word.length > longest.length ? word : longest, '');
  return Math.max(6, Math.min(requested, Math.floor(180 / Math.max(1, longestWord.length))));
}

export function rgbaFrameLooksBlank(data, { blackThreshold = 30, flatThreshold = 6 } = {}) {
  let darkest = 255;
  let brightest = 0;
  let visiblePixels = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] <= 8) continue;
    visiblePixels += 1;
    const pixelDarkest = Math.min(data[index], data[index + 1], data[index + 2]);
    const pixelBrightest = Math.max(data[index], data[index + 1], data[index + 2]);
    darkest = Math.min(darkest, pixelDarkest);
    brightest = Math.max(brightest, pixelBrightest);
  }
  if (!visiblePixels) return true;
  return brightest <= blackThreshold || (brightest - darkest <= flatThreshold && brightest <= blackThreshold + 18);
}

export function resolveCompanionGraphic(candidate, { blank = false, verified = null } = {}) {
  if (!blank) return candidate || null;
  return verified || null;
}

function rgbFromHex(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || ''));
  if (!match) return null;
  const number = Number.parseInt(match[1], 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

// Recolor only pixels that belong to Companion's text/background color ramp.
// Projecting antialiased edge pixels onto that ramp preserves the exact glyph
// shape instead of redrawing the text with a browser font.
export function recolorCompanionFrame(data, { sourceTextColor, sourceBackgroundColor, targetTextColor, targetBackgroundColor, rampTolerance = 30 } = {}) {
  const sourceText = rgbFromHex(sourceTextColor);
  const sourceBackground = rgbFromHex(sourceBackgroundColor);
  const targetText = rgbFromHex(targetTextColor);
  const targetBackground = rgbFromHex(targetBackgroundColor);
  const output = new Uint8ClampedArray(data);
  if (!sourceText || !sourceBackground || !targetText || !targetBackground) return output;
  const sourceVector = sourceText.map((channel, index) => channel - sourceBackground[index]);
  const targetVector = targetText.map((channel, index) => channel - targetBackground[index]);
  const denominator = sourceVector.reduce((sum, channel) => sum + channel * channel, 0);
  const toleranceSquared = rampTolerance * rampTolerance;
  for (let index = 0; index < output.length; index += 4) {
    if (output[index + 3] <= 8) continue;
    const pixel = [output[index], output[index + 1], output[index + 2]];
    const relative = pixel.map((channel, channelIndex) => channel - sourceBackground[channelIndex]);
    let mix = denominator > 0 ? relative.reduce((sum, channel, channelIndex) => sum + channel * sourceVector[channelIndex], 0) / denominator : 0;
    mix = Math.max(0, Math.min(1, mix));
    const projected = sourceBackground.map((channel, channelIndex) => channel + mix * sourceVector[channelIndex]);
    const rampDistance = pixel.reduce((sum, channel, channelIndex) => sum + (channel - projected[channelIndex]) ** 2, 0);
    const backgroundDistance = pixel.reduce((sum, channel, channelIndex) => sum + (channel - sourceBackground[channelIndex]) ** 2, 0);
    const textDistance = pixel.reduce((sum, channel, channelIndex) => sum + (channel - sourceText[channelIndex]) ** 2, 0);
    if (Math.min(rampDistance, backgroundDistance, textDistance) > toleranceSquared) continue;
    for (let channel = 0; channel < 3; channel += 1) output[index + channel] = Math.round(targetBackground[channel] + mix * targetVector[channel]);
  }
  return output;
}
