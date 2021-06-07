
function settingsComponent(props) {
  return (
    <Page>
      <Text><Text bold>Requests sent: </Text>{props.settingsStorage.getItem('sentCount')}</Text>
      <Text><Text bold>Requests sent error: </Text>{props.settingsStorage.getItem('catchCount')}</Text>
      <Text><Text bold>Server received ok: </Text>{props.settingsStorage.getItem('okCount')}</Text>
      <Text><Text bold>Server received error: </Text>{props.settingsStorage.getItem('errorCount')}</Text>
    </Page>
  );
}

registerSettingsPage(settingsComponent)