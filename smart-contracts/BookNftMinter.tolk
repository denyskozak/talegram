import "@stdlib/ledger";
import "@stdlib/nft";
import "@stdlib/tx";

contract BookNftMinter with Deployable {
    storage {
        admin: MsgAddress;
        nextIndex: Int;
        collectionContent: Cell;
        royalty: Int;
    }

    struct MintParams {
        bookId: Int;
        recipient: MsgAddress;
        metadataUri: Slice;
    }

    event NftMinted {
        bookId: Int;
        recipient: MsgAddress;
        nftAddress: MsgAddress;
        content: Cell;
    }

    init(admin: MsgAddress, collectionContent: Cell, royalty: Int) {
        self.admin = admin;
        self.nextIndex = 0;
        self.collectionContent = collectionContent;
        self.royalty = royalty;
    }

    receive("mint", params: MintParams) {
        require(sender() == self.admin, "BookNftMinter: only admin can mint");
        require(params.recipient.isStdAddr(), "BookNftMinter: invalid recipient address");

        let nftIndex = self.nextIndex;
        self.nextIndex += 1;

        let content = buildNftContent(params.bookId, params.metadataUri);
        let nftAddress = deployItem(
            DeployItem {
                index: nftIndex,
                owner: params.recipient,
                royalty: self.royalty,
                content: content,
                collectionContent: self.collectionContent
            }
        );

        emit(NftMinted {
            bookId: params.bookId,
            recipient: params.recipient,
            nftAddress: nftAddress,
            content: content
        });
    }

    receive("update_content", newContent: Cell) {
        require(sender() == self.admin, "BookNftMinter: only admin can update collection content");
        self.collectionContent = newContent;
    }

    receive("change_admin", newAdmin: MsgAddress) {
        require(sender() == self.admin, "BookNftMinter: only admin can change admin");
        require(newAdmin.isStdAddr(), "BookNftMinter: invalid new admin address");
        self.admin = newAdmin;
    }

    fn buildNftContent(bookId: Int, metadataUri: Slice): Cell {
        let builder = beginCell();
        builder.storeUint(bookId, 64);
        builder.storeSlice(metadataUri);
        return builder.endCell();
    }
}
