#include "../src/Text.h"
#include <cassert>
#include <cmath>

int main()
{
	using NSHtmlRenderer::TextSelectionNormalScale;
	const double epsilon = 1e-9;
	// PLU text: horizontal width is stretched to its quad, height stays 1em.
	assert(std::fabs(TextSelectionNormalScale(12, 0, 0, 1) - 1) < epsilon);
	// The reported PLU title has Tf=59.34 and Tm=[8.919884873 0 0 1 ...].
	// Its old selection height was ~529pt; the text's real height is ~59pt.
	const double pluScale = TextSelectionNormalScale(8.919884873, 0, 0, 1);
	assert(std::fabs(59.34 * pluScale - 59.34) < epsilon);
	// Ordinary scaled and rotated text keeps its existing proportional height.
	assert(std::fabs(TextSelectionNormalScale(2, 0, 0, 2) - 2) < epsilon);
	assert(std::fabs(TextSelectionNormalScale(0, 2, -2, 0) - 2) < epsilon);
	// A shear along the baseline cannot inflate selection height.
	assert(std::fabs(TextSelectionNormalScale(12, 0, 7, 1) - 1) < epsilon);
	assert(std::fabs(TextSelectionNormalScale(0, 0, 0, 1) - 1) < epsilon);
}
