import arrowRight from 'pixelarticons/svg/arrow-right.svg?raw';
import aspectRatio from 'pixelarticons/svg/aspect-ratio.svg?raw';
import cancel from 'pixelarticons/svg/cancel.svg?raw';
import check from 'pixelarticons/svg/check.svg?raw';
import chevronDown from 'pixelarticons/svg/chevron-down.svg?raw';
import chevronUp from 'pixelarticons/svg/chevron-up.svg?raw';
import frame from 'pixelarticons/svg/frame.svg?raw';
import infoBox from 'pixelarticons/svg/info-box.svg?raw';
import moreHorizontal from 'pixelarticons/svg/more-horizontal.svg?raw';
import openIcon from 'pixelarticons/svg/open.svg?raw';
import section from 'pixelarticons/svg/section.svg?raw';
import settings2 from 'pixelarticons/svg/settings-2.svg?raw';
import sparkles from 'pixelarticons/svg/sparkles.svg?raw';
import zoomIn from 'pixelarticons/svg/zoom-in.svg?raw';
import zoomOut from 'pixelarticons/svg/zoom-out.svg?raw';

export const icons = {
	'arrow-right': arrowRight,
	'aspect-ratio': aspectRatio,
	cancel,
	check,
	'chevron-down': chevronDown,
	'chevron-up': chevronUp,
	frame,
	'info-box': infoBox,
	'more-horizontal': moreHorizontal,
	open: openIcon,
	section,
	'settings-2': settings2,
	sparkles,
	'zoom-in': zoomIn,
	'zoom-out': zoomOut
} as const;

export type PixelIconName = keyof typeof icons;