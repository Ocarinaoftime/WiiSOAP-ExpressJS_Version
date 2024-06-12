interface Config {
    Address: string;
    SQLAddress: string;
    SQLUser: string;
    SQLPass: string;
    SQLDB: string;
}

interface Envelope {
    SOAPEnv: string;
    XSD: string;
    XSI: string;
    Body: Body;
    action: string;
}

interface Body {
    Response: Response;
}

interface Response {
    XMLNS: string;
    $name: string;
    $: { xmlns: string };
    Version: string;
    DeviceId: string;
    MessageId: string;
    TimeStamp: string;
    ErrorCode: number;
    ServiceStandbyMode: boolean;
    CustomFields: any[];
}

interface KVField {
    Value: string;
}

interface Balance {
    Amount: number;
    Currency: string;
}

interface Transactions {
    TransactionId: string;
    Date: string;
    Type: string;
}


