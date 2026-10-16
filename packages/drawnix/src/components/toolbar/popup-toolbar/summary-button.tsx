import { getSelectedElements, PlaitBoard } from '@plait/core';
import { MindElement } from '@plait/mind';
import { useI18n } from '../../../i18n';
import { addMindSummary, getMindSummarySelection } from '../../../utils/mind-summary';
import { SummaryIcon } from '../../icons';
import { ToolButton } from '../../tool-button';

export const PopupSummaryButton = ({ board }: { board: PlaitBoard }) => {
  const { t } = useI18n();
  const elements = getSelectedElements(board);
  if (
    PlaitBoard.isReadonly(board) ||
    PlaitBoard.hasBeenTextEditing(board) ||
    !elements.length ||
    !elements.every((element) => MindElement.isMindElement(board, element))
  ) {
    return null;
  }
  const enabled = !!getMindSummarySelection(board);

  return (
    <ToolButton
      className="property-button"
      visible={true}
      icon={SummaryIcon}
      type="icon"
      title={enabled ? t('mind.addSummary') : t('mind.summarySelectionHint')}
      aria-label={t('mind.addSummary')}
      disabled={!enabled}
      onKeyDown={(event) => {
        // Keep Enter/Space activation and Tab navigation, without invoking canvas shortcuts.
        event.stopPropagation();
      }}
      onClick={() => {
        addMindSummary(board);
      }}
    />
  );
};
