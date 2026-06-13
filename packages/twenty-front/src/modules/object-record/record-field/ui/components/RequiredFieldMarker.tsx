import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRequiredFieldMarker = styled.span`
  color: ${themeCssVariables.color.red};
  flex-shrink: 0;
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

export const RequiredFieldMarker = () => (
  <StyledRequiredFieldMarker aria-hidden="true">*</StyledRequiredFieldMarker>
);
