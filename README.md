<!--------------------------------------------------------->
<!---   C   R   O   W   D   F   U   N   D   I   N   G   --->
<!--------------------------------------------------------->
<h1>
    <img align="left" alt="Delve" width="45px" src="https://github.com/charis/resources/blob/main/images/crowdfunding-smart-contract/crowdfunding.png"/>Crowdfunding
</h1>

![Crowdfunding Screen Shots][crowdfunding-screenshots]

This is a simple crowdfunding solution that lets projects raise capital from diverse sources. So a project manager looking to raise money for their project can:

1. Start a campaign (including saving details of the campaign that contributors might want to look at before contributing)
2. Be able to edit campaign details
3. Set a crowdfunding goal
4. Set a crowdfunding deadline
5. If a campaign goal is met, be able to post updates for their donors to see

The other users of the platform are the contributors. They should have be able to:

1. Have access to all campaigns currently running
2. Donate a specific amount to a campaign
3. If the crowdfunding goal isn't met, get a full refund
4. If a vote of no confidence is passed, get a proportional refund (explained below)

The system itself has a few quirks:

1. If a campaign is funded, the entire amount isn't distributed all at once, but in installments
2. Before an installment is unlocked, the donors should have an option to pass a vote of no-confidence if they believe that the campaign no longer embodies the project they contributed to. This can be a simple majority vote or a weighted vote based on donation proportions (you do not have to implement the voting mechanism, just think about the design decisions choosing one or the other would imply)
3. If a vote of no confidence is passed, the campaign is immediately canceled and the leftover money raised should be refunded proportionally to the donors.

<!-- MARKDOWN LINKS & IMAGES -->
[crowdfunding-screenshots]: https://github.com/charis/resources/blob/main/images/crowdfunding-smart-contract/crowdfunding-smart-contract.gif
