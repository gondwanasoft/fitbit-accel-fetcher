
function settingsComponent(props) {
  return (
    <Page>
      <Text><Text bold>Last file forwarded: </Text>{props.settingsStorage.getItem('fileNbr')}</Text>
      <Text><Text bold>Status: </Text>{props.settingsStorage.getItem('status')}</Text>
    </Page>
  );
}

registerSettingsPage(settingsComponent)